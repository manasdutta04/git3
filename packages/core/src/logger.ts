export class Logger {
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  info(message: string): void {
    if (this.enabled) console.log(`[git3] ${message}`);
  }

  warn(message: string): void {
    if (this.enabled) console.warn(`[git3] ${message}`);
  }

  api(method: string, path: string, detail: string | undefined, ms: number): void {
    if (this.enabled) {
      const extra = detail ? ` ${detail}` : '';
      console.log(`[git3] ${method} ${path}${extra} ${ms}ms`);
    }
  }

  cache(hit: 'HIT' | 'SET', key: string): void {
    if (this.enabled) console.log(`[git3] Cache ${hit}: ${key}`);
  }

  rateLimit(remaining: number, limit: number, resetsAt: string): void {
    if (this.enabled) {
      console.log(`[git3] Rate limit: ${remaining}/${limit} remaining (resets ${resetsAt})`);
    }
  }
}
