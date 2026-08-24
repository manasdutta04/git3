import type { Filter, FindOptions, Git3Document } from './types.js';
import { applyFindOptions, matchesFilter } from './query.js';

export class FindCursor<T extends Git3Document> {
  private docs: T[];
  options: FindOptions<T> = {};

  constructor(docs: T[]) {
    this.docs = docs;
  }

  sort(sort: FindOptions<T>['sort']): this {
    this.options.sort = sort;
    return this;
  }

  limit(n: number): this {
    this.options.limit = n;
    return this;
  }

  skip(n: number): this {
    this.options.skip = n;
    return this;
  }

  async toArray(): Promise<T[]> {
    return applyFindOptions(this.docs, this.options);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}

export function filterDocuments<T extends Git3Document>(
  docs: T[],
  filter?: Filter<T>,
  options?: FindOptions<T>
): T[] {
  const filtered = filter ? docs.filter((d) => matchesFilter(d, filter)) : docs;
  return applyFindOptions(filtered, options);
}
