import type {
  Filter,
  FindOptions,
  Git3Document,
  IndexData,
  UpdateDoc,
  WhereOperator,
} from './types.js';

function isOperator(value: unknown): value is WhereOperator {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.keys(value).some((k) => k.startsWith('$'));
}

function matchOperator(fieldValue: unknown, op: WhereOperator): boolean {
  if ('$eq' in op && fieldValue !== op.$eq) return false;
  if ('$ne' in op && fieldValue === op.$ne) return false;
  if ('$gt' in op && !(fieldValue > (op.$gt as never))) return false;
  if ('$gte' in op && !(fieldValue >= (op.$gte as never))) return false;
  if ('$lt' in op && !(fieldValue < (op.$lt as never))) return false;
  if ('$lte' in op && !(fieldValue <= (op.$lte as never))) return false;
  if ('$in' in op && !op.$in!.includes(fieldValue as never)) return false;
  if ('$nin' in op && op.$nin!.includes(fieldValue as never)) return false;
  if ('$exists' in op) {
    const exists = fieldValue !== undefined && fieldValue !== null;
    if (op.$exists !== exists) return false;
  }
  if (typeof fieldValue === 'string') {
    if ('$contains' in op && !fieldValue.includes(op.$contains!)) return false;
    if ('$startsWith' in op && !fieldValue.startsWith(op.$startsWith!)) return false;
    if ('$endsWith' in op && !fieldValue.endsWith(op.$endsWith!)) return false;
  }
  return true;
}

export function matchesFilter<T extends Git3Document>(
  doc: T,
  filter?: Filter<T>
): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, expected] of Object.entries(filter)) {
    const value = doc[key as keyof T];
    if (isOperator(expected)) {
      if (!matchOperator(value, expected)) return false;
    } else if (value !== expected) {
      return false;
    }
  }
  return true;
}

export function applyFindOptions<T extends Git3Document>(
  docs: T[],
  options?: FindOptions<T>
): T[] {
  let result = [...docs];

  if (options?.sort) {
    const entries = Object.entries(options.sort);
    result.sort((a, b) => {
      for (const [field, dir] of entries) {
        const av = a[field as keyof T];
        const bv = b[field as keyof T];
        if (av === bv) continue;
        const asc = dir === 1 || dir === 'asc';
        if (av == null) return asc ? -1 : 1;
        if (bv == null) return asc ? 1 : -1;
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
      }
      return 0;
    });
  }

  if (options?.skip) result = result.slice(options.skip);
  if (options?.limit != null) result = result.slice(0, options.limit);

  return result;
}

export function applyUpdate<T extends Git3Document>(
  doc: T,
  update: UpdateDoc<T>
): T {
  const next = { ...doc } as T;
  if (update.$set) {
    Object.assign(next, update.$set);
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      delete next[key as keyof T];
    }
  }
  return next;
}

export function buildIndexEntry(doc: Git3Document): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') continue;
    if (value === null || typeof value === 'object') continue;
    entry[key] = value;
  }
  return entry;
}

export function indexMatchesFilter(index: IndexData, filter?: Filter<Git3Document>): string[] {
  if (!filter || Object.keys(filter).length === 0) {
    return Object.keys(index);
  }

  return Object.entries(index)
    .filter(([, entry]) => {
      const pseudoDoc = { _id: '', ...entry } as Git3Document;
      return matchesFilter(pseudoDoc, filter);
    })
    .map(([id]) => id);
}

export function countMatching<T extends Git3Document>(
  docs: T[],
  filter?: Filter<T>
): number {
  return docs.filter((d) => matchesFilter(d, filter)).length;
}
