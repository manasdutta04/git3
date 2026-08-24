import { GitHubClient } from './github-client.js';
import { Cache } from './cache.js';
import { Encryption } from './encryption.js';

const KV_PATH = 'kv/store.json';

export class KVStore {
  private github: GitHubClient;
  private encryption: Encryption | null;

  constructor(github: GitHubClient, _cache: Cache, encryption: Encryption | null) {
    this.github = github;
    this.encryption = encryption;
  }

  private serialize(content: string): string {
    return this.encryption ? this.encryption.encrypt(content) : content;
  }

  private deserialize(content: string): string {
    return this.encryption ? this.encryption.decrypt(content) : content;
  }

  private async loadStore(): Promise<{ data: Record<string, unknown>; sha?: string }> {
    const file = await this.github.getFile(KV_PATH);
    if (!file) return { data: {} };
    const raw = this.deserialize(file.content);
    return { data: JSON.parse(raw), sha: file.sha };
  }

  private async saveStore(data: Record<string, unknown>, sha?: string): Promise<void> {
    const content = this.serialize(JSON.stringify(data, null, 2));
    await this.github.putFile(KV_PATH, content, '[git3] update kv store', sha);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const { data } = await this.loadStore();
    return data[key] as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    const { data, sha } = await this.loadStore();
    data[key] = value;
    await this.saveStore(data, sha);
  }

  async has(key: string): Promise<boolean> {
    const { data } = await this.loadStore();
    return Object.prototype.hasOwnProperty.call(data, key);
  }

  async delete(key: string): Promise<boolean> {
    const { data, sha } = await this.loadStore();
    if (!Object.prototype.hasOwnProperty.call(data, key)) return false;
    delete data[key];
    await this.saveStore(data, sha);
    return true;
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    const { data, sha } = await this.loadStore();
    Object.assign(data, entries);
    await this.saveStore(data, sha);
  }

  async deleteMany(keys: string[]): Promise<void> {
    const { data, sha } = await this.loadStore();
    for (const key of keys) delete data[key];
    await this.saveStore(data, sha);
  }

  async increment(key: string, amount = 1): Promise<number> {
    const { data, sha } = await this.loadStore();
    const current = typeof data[key] === 'number' ? (data[key] as number) : 0;
    const next = current + amount;
    data[key] = next;
    await this.saveStore(data, sha);
    return next;
  }

  async toggle(key: string): Promise<boolean> {
    const { data, sha } = await this.loadStore();
    const current = Boolean(data[key]);
    const next = !current;
    data[key] = next;
    await this.saveStore(data, sha);
    return next;
  }

  async keys(): Promise<string[]> {
    const { data } = await this.loadStore();
    return Object.keys(data);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const { data } = await this.loadStore();
    return { ...data };
  }

  async size(): Promise<number> {
    const { data } = await this.loadStore();
    return Object.keys(data).length;
  }

  async clear(): Promise<void> {
    await this.saveStore({});
  }
}
