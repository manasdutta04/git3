import { readFile, writeFile } from 'node:fs/promises';
import { Collection } from './collection.js';
import type { ExportOptions, Filter, Git3Document, ImportOptions } from './types.js';
import { matchesFilter } from './query.js';

function detectFormat(path: string): 'json' | 'csv' {
  return path.endsWith('.csv') ? 'csv' : 'json';
}

function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

function toCsv(docs: Git3Document[]): string {
  if (docs.length === 0) return '';
  const keys = Array.from(
    docs.reduce((set, doc) => {
      Object.keys(doc).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const header = keys.join(',');
  const rows = docs.map((doc) =>
    keys.map((k) => JSON.stringify(doc[k] ?? '')).join(',')
  );
  return [header, ...rows].join('\n');
}

export async function importCollectionFromFile<T extends Git3Document>(
  collection: Collection<T>,
  filePath: string,
  options: ImportOptions = {}
): Promise<number> {
  const format = options.format ?? detectFormat(filePath);
  const raw = await readFile(filePath, 'utf-8');

  let records: Partial<T>[];
  if (format === 'csv') {
    records = parseCsv(raw) as Partial<T>[];
  } else {
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed) ? parsed : [parsed];
  }

  const idField = options.idField ?? '_id';

  if (options.clear) await collection.drop();

  const normalized = records.map((record) => {
    const copy = { ...record } as Partial<T> & Record<string, unknown>;
    if (copy[idField] != null && copy._id == null) {
      copy._id = String(copy[idField]) as T['_id'];
      delete copy[idField];
    }
    return copy;
  });

  await collection.insertMany(normalized);
  return normalized.length;
}

export async function exportCollectionToFile<T extends Git3Document>(
  collection: Collection<T>,
  filePath: string,
  options: ExportOptions = {}
): Promise<number> {
  const format = options.format ?? detectFormat(filePath);
  let docs = await collection.findAll();

  if (options.filter) {
    docs = docs.filter((d) => matchesFilter(d, options.filter as Filter<T>));
  }

  const content = format === 'csv' ? toCsv(docs) : JSON.stringify(docs, null, 2);
  await writeFile(filePath, content, 'utf-8');
  return docs.length;
}

export async function listCollectionNames(github: {
  listDirectory(path: string): Promise<Array<{ name: string; type: string }>>;
}): Promise<string[]> {
  const entries = await github.listDirectory('collections');
  return entries.filter((e) => e.type === 'dir').map((e) => e.name);
}
