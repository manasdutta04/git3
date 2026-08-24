import type { CacheEntry } from './types.js';

const DEFAULT_TTL = 60_000;

export class Cache {
  private store = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(ttlMs = DEFAULT_TTL) {
    this.defaultTtl = ttlMs;
  }

  get<T = unknown>(key: string): (CacheEntry<T> & { fresh: boolean }) | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const fresh = Date.now() - entry.timestamp < entry.ttl;
    return { ...entry, fresh };
  }

  set<T = unknown>(key: string, data: T, sha: string, ttlMs?: number): void {
    this.store.set(key, {
      data,
      sha,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.defaultTtl,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  getSha(key: string): string | null {
    return this.store.get(key)?.sha ?? null;
  }
}
