import { Cache } from './cache.js';
import { Logger } from './logger.js';
import {
  AuthenticationError,
  ConflictError,
  Git3Error,
  GitHubApiError,
  NotFoundError,
  RateLimitError,
} from './errors.js';
import type {
  BatchOperation,
  GitHubFileContent,
  GitHubRateLimit,
  PathCommit,
  ResolvedConfig,
} from './types.js';

export class GitHubClient {
  private config: ResolvedConfig;
  private cache: Cache;
  private logger: Logger;
  private baseUrl = 'https://api.github.com';
  private initHook: (() => Promise<void>) | null = null;

  constructor(config: ResolvedConfig, cache: Cache, logger: Logger) {
    this.config = config;
    this.cache = cache;
    this.logger = logger;
  }

  setInitHook(hook: () => Promise<void>): void {
    this.initHook = hook;
  }

  private async ensureReady(): Promise<void> {
    if (this.initHook) await this.initHook();
  }

  private contentPath(path: string): string {
    return `/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
  }

  private contentPathWrite(path: string): string {
    return `/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: { ...this.headers, ...(options.headers as Record<string, string>) },
    });
    return response;
  }

  private isNetworkError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('fetch failed') || msg.includes('network') || msg.includes('econn');
  }

  private getBackoffDelay(attempt: number): number {
    const { backoff, baseDelay } = this.config.retry;
    switch (backoff) {
      case 'linear':
        return baseDelay * (attempt + 1);
      case 'fixed':
        return baseDelay;
      case 'exponential':
      default:
        return baseDelay * Math.pow(2, attempt);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private wrapHttpError(status: number, message: string): Git3Error {
    if (status === 401 || status === 403) return new AuthenticationError(message);
    return new GitHubApiError(message, status);
  }

  private async withRetry<T>(fn: () => Promise<T>, filePath?: string): Promise<T> {
    const { enabled, maxRetries } = this.config.retry;
    const attempts = enabled ? maxRetries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (this.isNetworkError(err)) throw err;
        if (err instanceof RateLimitError || err instanceof AuthenticationError) throw err;

        if (err instanceof ConflictError && filePath) {
          this.cache.invalidate(`file:${filePath}`);
          if (attempt < attempts - 1) {
            this.logger.warn(`Conflict on "${filePath}", retrying (${attempt + 1}/${attempts})`);
            await this.delay(this.getBackoffDelay(attempt));
            continue;
          }
        }

        if (attempt < attempts - 1) {
          this.logger.warn(`Request failed (${attempt + 1}/${attempts}), retrying...`);
          await this.delay(this.getBackoffDelay(attempt));
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new GitHubApiError(String(lastError), 500);
  }

  private checkRateLimit(response: Response): void {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (response.status === 403 && remaining === '0') {
      const reset = response.headers.get('x-ratelimit-reset');
      const resetsAt = reset ? new Date(Number(reset) * 1000) : new Date(Date.now() + 60_000);
      const retryAfter = Math.max(1, Math.ceil((resetsAt.getTime() - Date.now()) / 1000));
      throw new RateLimitError(retryAfter, resetsAt.toISOString());
    }
  }

  async ensureRepo(): Promise<void> {
    const response = await this.request(`/repos/${this.config.owner}/${this.config.repo}`);
    if (response.ok) {
      this.logger.info(`Repository "${this.config.owner}/${this.config.repo}" exists`);
      return;
    }

    if (response.status === 404) {
      this.logger.info(`Creating private repository "${this.config.repo}"...`);
      const create = await this.request('/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: this.config.repo,
          private: true,
          auto_init: true,
          description: 'git3 data repository — managed by git3',
        }),
      });
      if (!create.ok) {
        const body = await create.text();
        if (create.status === 403) {
          throw new AuthenticationError(
            'This token cannot create repositories. Use Connect with GitHub, a classic token with the repo scope, or create the repo on GitHub first.'
          );
        }
        throw this.wrapHttpError(create.status, body || create.statusText);
      }
      this.logger.info(`Repository "${this.config.repo}" created`);
      return;
    }

    this.checkRateLimit(response);
    const body = await response.text();
    throw this.wrapHttpError(response.status, body || response.statusText);
  }

  async ensureBranch(): Promise<void> {
    if (this.config.branch === 'main') return;

    const response = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/branches/${this.config.branch}`
    );
    if (response.ok) return;

    if (response.status === 404) {
      const mainRef = await this.request(
        `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/main`
      );
      if (!mainRef.ok) throw this.wrapHttpError(mainRef.status, await mainRef.text());
      const mainData = (await mainRef.json()) as { object: { sha: string } };
      const create = await this.request(
        `/repos/${this.config.owner}/${this.config.repo}/git/refs`,
        {
          method: 'POST',
          body: JSON.stringify({
            ref: `refs/heads/${this.config.branch}`,
            sha: mainData.object.sha,
          }),
        }
      );
      if (!create.ok) throw this.wrapHttpError(create.status, await create.text());
      this.logger.info(`Branch "${this.config.branch}" created`);
      return;
    }

    this.checkRateLimit(response);
    throw this.wrapHttpError(response.status, await response.text());
  }

  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    await this.ensureReady();
    const cacheKey = `file:${path}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached?.fresh) {
      this.logger.cache('HIT', cacheKey);
      return { content: cached.data, sha: cached.sha };
    }

    const start = Date.now();
    const response = await this.withRetry(async () => {
      const res = await this.request(
        this.contentPath(path)
      );
      this.checkRateLimit(res);
      if (res.status === 404) return null;
      if (res.status === 409) throw new ConflictError(path);
      if (!res.ok) throw this.wrapHttpError(res.status, await res.text());
      return res;
    }, path);

    if (!response) {
      this.logger.api('GET', path, '404', Date.now() - start);
      return null;
    }

    const data = (await response.json()) as GitHubFileContent;
    if (data.type !== 'file') return null;
    const content = Buffer.from(data.content || '', 'base64').toString('utf-8');
    this.cache.set(cacheKey, content, data.sha);
    this.logger.api('GET', path, 'cache MISS', Date.now() - start);
    return { content, sha: data.sha };
  }

  async getBinaryFile(path: string): Promise<{ content: Buffer; sha: string } | null> {
    await this.ensureReady();
    const response = await this.request(
      this.contentPath(path)
    );
    if (response.status === 404) return null;
    if (!response.ok) throw this.wrapHttpError(response.status, await response.text());
    const data = (await response.json()) as GitHubFileContent;
    if (data.type !== 'file') return null;
    return {
      content: Buffer.from(data.content || '', 'base64'),
      sha: data.sha,
    };
  }

  async putFile(path: string, content: string, message: string, sha?: string): Promise<string> {
    await this.ensureReady();
    const start = Date.now();
    if (!sha) sha = this.cache.getSha(`file:${path}`) ?? undefined;

    const result = await this.withRetry(async () => {
      const res = await this.request(
        this.contentPathWrite(path),
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            branch: this.config.branch,
            ...(sha ? { sha } : {}),
          }),
        }
      );
      this.checkRateLimit(res);
      if (res.status === 409) throw new ConflictError(path);
      if (!res.ok) throw this.wrapHttpError(res.status, await res.text());
      return (await res.json()) as { content?: { sha?: string } };
    }, path);

    const newSha = result.content?.sha || '';
    this.cache.set(`file:${path}`, content, newSha);
    this.logger.api('PUT', path, `SHA ${newSha.slice(0, 7)}`, Date.now() - start);
    return newSha;
  }

  async putBinaryFile(path: string, content: Buffer, message: string, sha?: string): Promise<string> {
    await this.ensureReady();
    if (!sha) sha = this.cache.getSha(`file:${path}`) ?? undefined;
    const result = await this.withRetry(async () => {
      const res = await this.request(
        this.contentPathWrite(path),
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: content.toString('base64'),
            branch: this.config.branch,
            ...(sha ? { sha } : {}),
          }),
        }
      );
      this.checkRateLimit(res);
      if (res.status === 409) throw new ConflictError(path);
      if (!res.ok) throw this.wrapHttpError(res.status, await res.text());
      return (await res.json()) as { content?: { sha?: string } };
    }, path);
    return result.content?.sha || '';
  }

  async deleteFile(path: string, message: string, sha?: string): Promise<void> {
    await this.ensureReady();
    if (!sha) {
      sha = this.cache.getSha(`file:${path}`) ?? undefined;
      if (!sha) {
        const existing = await this.getFile(path);
        if (!existing) throw new NotFoundError(path);
        sha = existing.sha;
      }
    }

    await this.withRetry(async () => {
      const res = await this.request(
        this.contentPathWrite(path),
        {
          method: 'DELETE',
          body: JSON.stringify({ message, sha, branch: this.config.branch }),
        }
      );
      this.checkRateLimit(res);
      if (res.status === 409) throw new ConflictError(path);
      if (!res.ok) throw this.wrapHttpError(res.status, await res.text());
    }, path);

    this.cache.invalidate(`file:${path}`);
  }

  async listDirectory(path: string): Promise<GitHubFileContent[]> {
    await this.ensureReady();
    const cacheKey = `dir:${path}`;
    const cached = this.cache.get<GitHubFileContent[]>(cacheKey);
    if (cached?.fresh) {
      this.logger.cache('HIT', cacheKey);
      return cached.data;
    }

    const start = Date.now();
    const response = await this.request(
      this.contentPath(path)
    );
    if (response.status === 404) return [];
    if (!response.ok) throw this.wrapHttpError(response.status, await response.text());
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    this.cache.set(cacheKey, data, '', 30_000);
    this.logger.api('LIST', path, `${data.length} items`, Date.now() - start);
    return data as GitHubFileContent[];
  }

  async batchCommit(operations: BatchOperation[], message: string): Promise<void> {
    await this.ensureReady();
    if (operations.length === 0) return;

    const start = Date.now();
    const deletePaths = new Set(
      operations.filter((op) => op.type === 'delete').map((op) => op.path)
    );
    const createUpdateOps = operations.filter((op) => op.type !== 'delete');

    const refRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.branch}`
    );
    if (!refRes.ok) throw this.wrapHttpError(refRes.status, await refRes.text());
    const refData = (await refRes.json()) as { object: { sha: string } };
    const latestCommitSha = refData.object.sha;

    const treeRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/trees/${latestCommitSha}?recursive=1`
    );
    if (!treeRes.ok) throw this.wrapHttpError(treeRes.status, await treeRes.text());
    const fullTree = (await treeRes.json()) as {
      tree: Array<{ path?: string; mode?: string; type?: string; sha?: string }>;
    };

    // Blobs only: recursive trees include parent `tree` entries that still
    // contain deleted paths, which would restore files after a "delete".
    const existingEntries = fullTree.tree
      .filter((entry) => entry.path && entry.type === 'blob' && !deletePaths.has(entry.path))
      .map((entry) => ({
        path: entry.path!,
        mode: (entry.mode as '100644' | '100755') || '100644',
        type: 'blob' as const,
        sha: entry.sha!,
      }));

    const updatePaths = new Set(createUpdateOps.map((op) => op.path));
    const newEntries = await Promise.all(
      createUpdateOps.map(async (op) => {
        const content = op.binary
          ? (op.content as Buffer).toString('base64')
          : Buffer.from(op.content as string).toString('base64');
        const blobRes = await this.request(
          `/repos/${this.config.owner}/${this.config.repo}/git/blobs`,
          {
            method: 'POST',
            body: JSON.stringify({ content, encoding: 'base64' }),
          }
        );
        if (!blobRes.ok) throw this.wrapHttpError(blobRes.status, await blobRes.text());
        const blob = (await blobRes.json()) as { sha: string };
        return {
          path: op.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    const mergedEntries = [
      ...existingEntries.filter((e) => !updatePaths.has(e.path)),
      ...newEntries,
    ];

    const newTreeRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({ tree: mergedEntries }),
      }
    );
    if (!newTreeRes.ok) throw this.wrapHttpError(newTreeRes.status, await newTreeRes.text());
    const newTree = (await newTreeRes.json()) as { sha: string };

    const commitRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: newTree.sha,
          parents: [latestCommitSha],
        }),
      }
    );
    if (!commitRes.ok) throw this.wrapHttpError(commitRes.status, await commitRes.text());
    const newCommit = (await commitRes.json()) as { sha: string };

    const updateRefRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/${this.config.branch}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha }),
      }
    );
    if (!updateRefRes.ok) throw this.wrapHttpError(updateRefRes.status, await updateRefRes.text());

    for (const op of operations) {
      this.cache.invalidate(`file:${op.path}`);
      const dirPath = op.path.split('/').slice(0, -1).join('/');
      if (dirPath) this.cache.invalidate(`dir:${dirPath}`);
    }

    this.logger.api(
      'BATCH',
      `${operations.length} files`,
      `commit ${newCommit.sha.slice(0, 7)}`,
      Date.now() - start
    );
  }

  async getTreeContents(dirPath: string): Promise<Array<{ path: string; sha: string }>> {
    await this.ensureReady();
    const start = Date.now();
    const refRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.branch}`
    );
    if (!refRes.ok) throw this.wrapHttpError(refRes.status, await refRes.text());
    const refData = (await refRes.json()) as { object: { sha: string } };

    const treeRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/trees/${refData.object.sha}?recursive=1`
    );
    if (!treeRes.ok) throw this.wrapHttpError(treeRes.status, await treeRes.text());
    const fullTree = (await treeRes.json()) as {
      tree: Array<{ path?: string; type?: string; sha?: string }>;
    };

    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const entries = fullTree.tree
      .filter(
        (entry) =>
          entry.type === 'blob' &&
          entry.path?.startsWith(prefix) &&
          entry.path.endsWith('.json') &&
          !entry.path.endsWith('_index.json')
      )
      .map((entry) => ({ path: entry.path!, sha: entry.sha! }));

    this.logger.api('TREE', dirPath, `${entries.length} blobs`, Date.now() - start);
    return entries;
  }

  async listBlobs(dirPath: string): Promise<Array<{ path: string; sha: string; size: number }>> {
    await this.ensureReady();
    const start = Date.now();
    const refRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.branch}`
    );
    if (!refRes.ok) throw this.wrapHttpError(refRes.status, await refRes.text());
    const refData = (await refRes.json()) as { object: { sha: string } };

    const treeRes = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/trees/${refData.object.sha}?recursive=1`
    );
    if (!treeRes.ok) throw this.wrapHttpError(treeRes.status, await treeRes.text());
    const fullTree = (await treeRes.json()) as {
      tree: Array<{ path?: string; type?: string; sha?: string; size?: number }>;
    };

    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const entries = fullTree.tree
      .filter((entry) => entry.type === 'blob' && entry.path?.startsWith(prefix))
      .map((entry) => ({ path: entry.path!, sha: entry.sha!, size: entry.size ?? 0 }));

    this.logger.api('TREE', dirPath, `${entries.length} files`, Date.now() - start);
    return entries;
  }

  async getBlob(sha: string): Promise<string> {
    const response = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/git/blobs/${sha}`
    );
    if (!response.ok) throw this.wrapHttpError(response.status, await response.text());
    const data = (await response.json()) as { content: string };
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async listPathCommits(path: string, limit = 20): Promise<PathCommit[]> {
    await this.ensureReady();
    const response = await this.request(
      `/repos/${this.config.owner}/${this.config.repo}/commits?path=${encodeURIComponent(path)}&per_page=${limit}&sha=${encodeURIComponent(this.config.branch)}`
    );
    if (!response.ok) throw this.wrapHttpError(response.status, await response.text());
    const data = (await response.json()) as Array<{
      sha: string;
      html_url: string;
      commit: {
        message: string;
        author?: { name?: string; date?: string };
        committer?: { name?: string; date?: string };
      };
    }>;
    return data.map((entry) => ({
      sha: entry.sha,
      message: entry.commit.message.split('\n')[0] || entry.commit.message,
      date: entry.commit.author?.date || entry.commit.committer?.date || '',
      author: entry.commit.author?.name || entry.commit.committer?.name || 'unknown',
      url: entry.html_url,
    }));
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    const response = await this.request('/rate_limit');
    if (!response.ok) throw this.wrapHttpError(response.status, await response.text());
    const data = (await response.json()) as {
      resources: { core: { limit: number; remaining: number; used: number; reset: number } };
    };
    const core = data.resources.core;
    const resetsAt = new Date(core.reset * 1000).toISOString();
    this.logger.rateLimit(core.remaining, core.limit, resetsAt);
    return {
      limit: core.limit,
      remaining: core.remaining,
      used: core.used,
      resetsAt,
    };
  }

  getConfig(): ResolvedConfig {
    return this.config;
  }
}
