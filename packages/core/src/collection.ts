import { randomUUID } from 'node:crypto';
import { GitHubClient } from './github-client.js';
import { Cache } from './cache.js';
import { Logger } from './logger.js';
import { Encryption } from './encryption.js';
import { validateData } from './schema.js';
import { FindCursor, filterDocuments } from './cursor.js';
import {
  applyFindOptions,
  applyUpdate,
  buildIndexEntry,
  countMatching,
  indexMatchesFilter,
  matchesFilter,
} from './query.js';
import type {
  BatchOperation,
  CollectionHooks,
  CollectionOptions,
  Filter,
  Git3Document,
  IndexData,
  SchemaDefinition,
  UpdateDoc,
} from './types.js';

export class Collection<T extends Git3Document = Git3Document> {
  private name: string;
  private basePath: string;
  private indexPath: string;
  private github: GitHubClient;
  private cache: Cache;
  private logger: Logger;
  private encryption: Encryption | null;
  private schema: SchemaDefinition | null;
  private hooks: CollectionHooks<T>;

  constructor(
    name: string,
    github: GitHubClient,
    cache: Cache,
    logger: Logger,
    encryption: Encryption | null,
    options?: CollectionOptions<T>
  ) {
    this.name = name;
    this.basePath = `collections/${name}`;
    this.indexPath = `${this.basePath}/_index.json`;
    this.github = github;
    this.cache = cache;
    this.logger = logger;
    this.encryption = encryption;
    this.schema = options?.schema ?? null;
    this.hooks = options?.hooks ?? {};
  }

  private docPath(id: string): string {
    return `${this.basePath}/${id}.json`;
  }

  private serialize(content: string): string {
    return this.encryption ? this.encryption.encrypt(content) : content;
  }

  private deserialize(content: string): string {
    return this.encryption ? this.encryption.decrypt(content) : content;
  }

  private async loadIndex(): Promise<{ index: IndexData; sha?: string }> {
    const cacheKey = `file:${this.indexPath}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached?.fresh) {
      return { index: JSON.parse(cached.data), sha: cached.sha };
    }

    const file = await this.github.getFile(this.indexPath);
    if (!file) return { index: {} };
    this.cache.set(cacheKey, file.content, file.sha);
    return { index: JSON.parse(file.content), sha: file.sha };
  }

  private async saveIndex(index: IndexData, sha?: string): Promise<void> {
    const content = JSON.stringify(index, null, 2);
    await this.github.putFile(
      this.indexPath,
      this.serialize(content),
      `[git3] update index ${this.name}`,
      sha
    );
  }

  private async parseDocument(path: string, sha: string, rawContent?: string): Promise<T> {
    const cacheKey = `file:${path}`;
    let content = rawContent;
    if (!content) {
      const cached = this.cache.get<string>(cacheKey);
      if (cached?.fresh) {
        content = cached.data;
      } else {
        content = await this.github.getBlob(sha);
        this.cache.set(cacheKey, content, sha);
      }
    }
    content = this.deserialize(content);
    return JSON.parse(content) as T;
  }

  private validate(doc: Record<string, unknown>): Record<string, unknown> {
    if (this.schema) return validateData(doc, this.schema);
    return doc;
  }

  private generateId(): string {
    return randomUUID().split('-')[0]!;
  }

  async insertOne(doc: Partial<T>): Promise<T> {
    let record = { ...doc } as Partial<T>;
    if (this.hooks.beforeInsert) record = await this.hooks.beforeInsert(record);

    if (!record._id) record._id = this.generateId() as T['_id'];
    const validated = this.validate(record as Record<string, unknown>) as T;
    const id = String(validated._id);
    const path = this.docPath(id);
    const content = this.serialize(JSON.stringify(validated, null, 2));

    await this.github.putFile(path, content, `[git3] insert ${this.name}/${id}`);

    const { index, sha } = await this.loadIndex();
    index[id] = buildIndexEntry(validated);
    await this.saveIndex(index, sha);

    if (this.hooks.afterInsert) await this.hooks.afterInsert(validated);
    this.logger.info(`Inserted ${this.name}/${id}`);
    return validated;
  }

  async insertMany(docs: Partial<T>[]): Promise<T[]> {
    const results: T[] = [];
    const ops: BatchOperation[] = [];
    const indexUpdates: IndexData = {};
    const { index } = await this.loadIndex();

    for (let doc of docs) {
      if (this.hooks.beforeInsert) doc = await this.hooks.beforeInsert(doc);
      if (!doc._id) doc._id = this.generateId() as T['_id'];
      const validated = this.validate(doc as Record<string, unknown>) as T;
      const id = String(validated._id);
      const path = this.docPath(id);
      ops.push({
        type: 'create',
        path,
        content: this.serialize(JSON.stringify(validated, null, 2)),
      });
      indexUpdates[id] = buildIndexEntry(validated);
      results.push(validated);
    }

    const mergedIndex = { ...index, ...indexUpdates };
    ops.push({
      type: 'create',
      path: this.indexPath,
      content: this.serialize(JSON.stringify(mergedIndex, null, 2)),
    });

    await this.github.batchCommit(ops, `[git3] insertMany ${docs.length} in ${this.name}`);

    for (const record of results) {
      if (this.hooks.afterInsert) await this.hooks.afterInsert(record);
    }

    return results;
  }

  async findById(id: string): Promise<T | null> {
    const path = this.docPath(id);
    const file = await this.github.getFile(path);
    if (!file) return null;
    return this.parseDocument(path, file.sha, file.content);
  }

  async findAll(): Promise<T[]> {
    const treeEntries = await this.github.getTreeContents(this.basePath);
    const records: T[] = [];

    for (const entry of treeEntries) {
      records.push(await this.parseDocument(entry.path, entry.sha));
    }

    return records;
  }

  find(filter: Filter<T> = {}): FindCursor<T> {
    const self = this;
    const cursor = new FindCursor<T>([]);

    const loadDocs = async (): Promise<T[]> => {
      const idFilter = (filter as Record<string, unknown>)._id;
      if (typeof idFilter === 'string') {
        const byId = await self.findById(idFilter);
        return byId && matchesFilter(byId, filter) ? [byId] : [];
      }

      const { index } = await self.loadIndex();
      const candidateIds = indexMatchesFilter(index, filter as Filter<Git3Document>);

      if (candidateIds.length === 0 && Object.keys(index).length === 0) {
        const all = await self.findAll();
        return filterDocuments(all, filter);
      }

      const docs: T[] = [];
      for (const id of candidateIds) {
        const doc = await self.findById(id);
        if (doc && matchesFilter(doc, filter)) docs.push(doc);
      }
      return docs;
    };

    cursor.toArray = async () => {
      const docs = await loadDocs();
      return applyFindOptions(docs, cursor.options);
    };

    cursor.count = async () => (await cursor.toArray()).length;

    return cursor;
  }

  async findOne(filter: Filter<T>): Promise<T | null> {
    const results = await this.find(filter).limit(1).toArray();
    return results[0] ?? null;
  }

  async countDocuments(filter: Filter<T> = {}): Promise<number> {
    const all = await this.findAll();
    return countMatching(all, filter);
  }

  async estimatedDocumentCount(): Promise<number> {
    const { index } = await this.loadIndex();
    return Object.keys(index).length || (await this.findAll()).length;
  }

  async updateOne(filter: Filter<T>, update: UpdateDoc<T>): Promise<T | null> {
    const existing = await this.findOne(filter);
    if (!existing) return null;

    let resolvedUpdate = update;
    if (this.hooks.beforeUpdate) {
      resolvedUpdate = await this.hooks.beforeUpdate(filter, update);
    }

    const updated = applyUpdate(existing, resolvedUpdate);
    this.validate(updated as Record<string, unknown>);

    const id = String(updated._id);
    const path = this.docPath(id);
    await this.github.putFile(
      path,
      this.serialize(JSON.stringify(updated, null, 2)),
      `[git3] update ${this.name}/${id}`
    );

    const { index, sha } = await this.loadIndex();
    index[id] = buildIndexEntry(updated);
    await this.saveIndex(index, sha);

    if (this.hooks.afterUpdate) await this.hooks.afterUpdate(updated);
    return updated;
  }

  async replaceOne(filter: Filter<T>, doc: Partial<T>): Promise<T | null> {
    const existing = await this.findOne(filter);
    if (!existing) return null;
    const replacement = { ...doc, _id: existing._id } as T;
    this.validate(replacement as Record<string, unknown>);
    const id = String(replacement._id);
    await this.github.putFile(
      this.docPath(id),
      this.serialize(JSON.stringify(replacement, null, 2)),
      `[git3] replace ${this.name}/${id}`
    );
    const { index, sha } = await this.loadIndex();
    index[id] = buildIndexEntry(replacement);
    await this.saveIndex(index, sha);
    return replacement;
  }

  async deleteOne(filter: Filter<T>): Promise<boolean> {
    const existing = await this.findOne(filter);
    if (!existing) return false;

    if (this.hooks.beforeDelete) await this.hooks.beforeDelete(filter);

    const id = String(existing._id);
    const ops: BatchOperation[] = [
      { type: 'delete', path: this.docPath(id) },
    ];

    const { index } = await this.loadIndex();
    delete index[id];
    ops.push({
      type: 'create',
      path: this.indexPath,
      content: this.serialize(JSON.stringify(index, null, 2)),
    });

    await this.github.batchCommit(ops, `[git3] delete ${this.name}/${id}`);

    if (this.hooks.afterDelete) await this.hooks.afterDelete(id);
    return true;
  }

  async deleteMany(filter: Filter<T>): Promise<number> {
    const toDelete = await this.find(filter).toArray();
    if (toDelete.length === 0) return 0;

    if (this.hooks.beforeDelete) await this.hooks.beforeDelete(filter);

    const { index } = await this.loadIndex();
    const ops: BatchOperation[] = [];

    for (const doc of toDelete) {
      const id = String(doc._id);
      ops.push({ type: 'delete', path: this.docPath(id) });
      delete index[id];
    }

    ops.push({
      type: 'create',
      path: this.indexPath,
      content: this.serialize(JSON.stringify(index, null, 2)),
    });

    await this.github.batchCommit(
      ops,
      `[git3] deleteMany ${toDelete.length} in ${this.name}`
    );

    for (const doc of toDelete) {
      if (this.hooks.afterDelete) await this.hooks.afterDelete(String(doc._id));
    }

    return toDelete.length;
  }

  async drop(): Promise<void> {
    const all = await this.findAll();
    const ops: BatchOperation[] = all.map((doc) => ({
      type: 'delete' as const,
      path: this.docPath(String(doc._id)),
    }));
    ops.push({ type: 'delete', path: this.indexPath });
    await this.github.batchCommit(ops, `[git3] drop ${this.name}`);
  }

  getCollectionName(): string {
    return this.name;
  }
}
