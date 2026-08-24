import { readFile } from 'node:fs/promises';
import { GitHubClient } from './github-client.js';
import type { StorageFileInfo } from './types.js';

export class FileStorage {
  private github: GitHubClient;
  private basePath = 'storage';

  constructor(github: GitHubClient) {
    this.github = github;
  }

  private fullPath(path: string): string {
    return `${this.basePath}/${path.replace(/^\/+/, '')}`;
  }

  async upload(path: string, content: string | Buffer): Promise<void> {
    const full = this.fullPath(path);
    if (Buffer.isBuffer(content)) {
      await this.github.putBinaryFile(full, content, `[git3] upload ${full}`);
    } else {
      await this.github.putFile(full, content, `[git3] upload ${full}`);
    }
  }

  async uploadFromPath(path: string, localPath: string): Promise<void> {
    const content = await readFile(localPath);
    await this.upload(path, content);
  }

  async download(path: string): Promise<Buffer> {
    const full = this.fullPath(path);
    const file = await this.github.getBinaryFile(full);
    if (!file) throw new Error(`File not found: ${path}`);
    return file.content;
  }

  getUrl(path: string): string {
    const config = this.github.getConfig();
    return `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${this.fullPath(path)}`;
  }

  async list(prefix = ''): Promise<StorageFileInfo[]> {
    const dir = prefix ? `${this.basePath}/${prefix.replace(/^\/+/, '')}` : this.basePath;
    try {
      const blobs = await this.github.listBlobs(dir);
      return blobs.map((entry) => {
        const relative = entry.path.replace(`${this.basePath}/`, '');
        return {
          name: relative.split('/').pop() || relative,
          path: relative,
          size: entry.size,
          sha: entry.sha,
          downloadUrl: null,
          type: 'file' as const,
        };
      });
    } catch {
      return [];
    }
  }

  async exists(path: string): Promise<boolean> {
    const file = await this.github.getBinaryFile(this.fullPath(path));
    return file !== null;
  }

  async info(path: string): Promise<StorageFileInfo | null> {
    const full = this.fullPath(path);
    const entries = await this.github.listDirectory(full.split('/').slice(0, -1).join('/') || this.basePath);
    const match = entries.find((e) => e.path === full);
    if (!match) return null;
    return {
      name: match.name,
      path,
      size: match.size,
      sha: match.sha,
      downloadUrl: null,
      type: 'file',
    };
  }

  async delete(path: string): Promise<void> {
    await this.github.deleteFile(this.fullPath(path), `[git3] delete storage/${path}`);
  }
}
