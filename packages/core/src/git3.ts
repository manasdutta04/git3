import { GitHubClient } from './github-client.js';
import { Cache } from './cache.js';
import { Logger } from './logger.js';
import { Encryption } from './encryption.js';
import { Collection } from './collection.js';
import { KVStore } from './kv.js';
import { FileStorage } from './storage.js';
import {
  exportCollectionToFile,
  importCollectionFromFile,
  listCollectionNames,
} from './import-export.js';
import { ConfigError } from './errors.js';
import type {
  CollectionOptions,
  ExportOptions,
  Git3Config,
  Git3Document,
  HealthStatus,
  ImportOptions,
  ResolvedConfig,
} from './types.js';

export class Git3 {
  private config: ResolvedConfig;
  private github: GitHubClient;
  private cache: Cache;
  private logger: Logger;
  private encryption: Encryption | null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private collections = new Map<string, Collection<Git3Document>>();
  private kvStore: KVStore | null = null;
  private storageInstance: FileStorage | null = null;

  static isConfigured(config: Git3Config = {}): boolean {
    const token = config.token ?? process.env.GIT3_TOKEN;
    const owner = config.owner ?? process.env.GIT3_OWNER;
    const repo = config.repo ?? process.env.GIT3_REPO;
    return Boolean(token && owner && repo);
  }

  constructor(config: Git3Config = {}) {
    this.config = this.resolveConfig(config);
    this.logger = new Logger(this.config.debug);
    this.cache = new Cache();
    this.encryption =
      this.config.encryption.enabled && this.config.encryption.key
        ? new Encryption(this.config.encryption.key)
        : null;
    this.github = new GitHubClient(this.config, this.cache, this.logger);
    this.github.setInitHook(() => this.init());
    this.logger.info(
      `git3 initialized for ${this.config.owner}/${this.config.repo} (branch: ${this.config.branch})`
    );
  }

  private resolveConfig(config: Git3Config): ResolvedConfig {
    const token = config.token ?? process.env.GIT3_TOKEN;
    const owner = config.owner ?? process.env.GIT3_OWNER;
    const repo = config.repo ?? process.env.GIT3_REPO;

    if (!token) throw new ConfigError('Missing token. Set GIT3_TOKEN or pass token in config.');
    if (!owner) throw new ConfigError('Missing owner. Set GIT3_OWNER or pass owner in config.');
    if (!repo) throw new ConfigError('Missing repo. Set GIT3_REPO or pass repo in config.');

    const encryptionEnabled =
      config.encryption?.enabled ??
      process.env.GIT3_ENCRYPTION_ENABLED === 'true';

    const encryptionKey =
      config.encryption?.key ?? process.env.GIT3_ENCRYPTION_KEY ?? null;

    return {
      token,
      owner,
      repo,
      branch: config.branch ?? process.env.GIT3_BRANCH ?? 'main',
      debug: config.debug ?? process.env.GIT3_DEBUG === 'true',
      retry: {
        enabled: config.retry?.enabled ?? true,
        maxRetries: config.retry?.maxRetries ?? 3,
        backoff: config.retry?.backoff ?? 'exponential',
        baseDelay: config.retry?.baseDelay ?? 1000,
      },
      encryption: {
        enabled: encryptionEnabled,
        key: encryptionKey,
      },
    };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.github.ensureRepo();
        await this.github.ensureBranch();
        this.initialized = true;
        this.logger.info('Initialization complete');
      })();
    }
    await this.initPromise;
  }

  private async ensureInit(): Promise<void> {
    await this.init();
  }

  collection<T extends Git3Document = Git3Document>(
    name: string,
    options?: CollectionOptions<T>
  ): Collection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(
        name,
        new Collection<T>(
          name,
          this.github,
          this.cache,
          this.logger,
          this.encryption,
          options
        ) as Collection<Git3Document>
      );
    }
    return this.collections.get(name)! as Collection<T>;
  }

  kv(): KVStore {
    if (!this.kvStore) {
      this.kvStore = new KVStore(this.github, this.cache, this.encryption);
    }
    return this.kvStore;
  }

  storage(): FileStorage {
    if (!this.storageInstance) {
      this.storageInstance = new FileStorage(this.github);
    }
    return this.storageInstance;
  }

  async health(): Promise<HealthStatus> {
    await this.ensureInit();
    const rateLimit = await this.github.getRateLimit();
    return {
      connected: true,
      repo: this.config.repo,
      owner: this.config.owner,
      branch: this.config.branch,
      rateLimit,
    };
  }

  async rateLimit() {
    return this.github.getRateLimit();
  }

  clearCache(): void {
    this.cache.clear();
  }

  info() {
    return {
      owner: this.config.owner,
      repo: this.config.repo,
      branch: this.config.branch,
      hasEncryption: this.config.encryption.enabled,
      debug: this.config.debug,
    };
  }

  async listCollections(): Promise<string[]> {
    await this.ensureInit();
    return listCollectionNames(this.github);
  }

  async import(collectionName: string, filePath: string, options?: ImportOptions): Promise<number> {
    await this.ensureInit();
    const col = this.collection(collectionName);
    return importCollectionFromFile(col, filePath, options);
  }

  async export(collectionName: string, filePath: string, options?: ExportOptions): Promise<number> {
    await this.ensureInit();
    const col = this.collection(collectionName);
    return exportCollectionToFile(col, filePath, options);
  }

  /** @internal Used by Studio */
  _getGitHubClient(): GitHubClient {
    return this.github;
  }
}
