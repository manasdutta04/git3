export interface Git3Config {
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  debug?: boolean;
  retry?: RetryConfig;
  encryption?: EncryptionConfig;
}

export interface RetryConfig {
  enabled?: boolean;
  maxRetries?: number;
  backoff?: 'exponential' | 'linear' | 'fixed';
  baseDelay?: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  key?: string;
}

export interface ResolvedConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  debug: boolean;
  retry: Required<RetryConfig>;
  encryption: { enabled: boolean; key: string | null };
}

export interface CollectionOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  schema?: SchemaDefinition;
  hooks?: CollectionHooks<T>;
}

export interface CollectionHooks<T extends Record<string, unknown> = Record<string, unknown>> {
  beforeInsert?: (data: Partial<T>) => Partial<T> | Promise<Partial<T>>;
  afterInsert?: (record: T) => void | Promise<void>;
  beforeUpdate?: (filter: Filter<T>, update: UpdateDoc<T>) => UpdateDoc<T> | Promise<UpdateDoc<T>>;
  afterUpdate?: (record: T) => void | Promise<void>;
  beforeDelete?: (filter: Filter<T>) => void | Promise<void>;
  afterDelete?: (id: string) => void | Promise<void>;
}

export type Filter<T> = Partial<T> | { [K in keyof T]?: T[K] | WhereOperator<T[K]> };

export interface WhereOperator<V = unknown> {
  $eq?: V;
  $ne?: V;
  $gt?: V;
  $gte?: V;
  $lt?: V;
  $lte?: V;
  $in?: V[];
  $nin?: V[];
  $contains?: string;
  $startsWith?: string;
  $endsWith?: string;
  $exists?: boolean;
}

export interface UpdateDoc<T> {
  $set?: Partial<T>;
  $unset?: Partial<Record<keyof T, '' | 1 | true>>;
}

export interface FindOptions<T> {
  sort?: Partial<Record<keyof T, 1 | -1 | 'asc' | 'desc'>>;
  limit?: number;
  skip?: number;
}

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface SchemaFieldDefinition {
  type: SchemaFieldType;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
}

export type SchemaDefinition = Record<string, SchemaFieldDefinition>;

export interface ValidationFieldError {
  field: string;
  message: string;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  used: number;
  resetsAt: string;
}

export interface HealthStatus {
  connected: boolean;
  repo: string;
  owner: string;
  branch: string;
  rateLimit: GitHubRateLimit;
}

export interface CacheEntry<T = unknown> {
  data: T;
  sha: string;
  timestamp: number;
  ttl: number;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

export interface StorageFileInfo {
  name: string;
  path: string;
  size: number;
  sha: string;
  downloadUrl: string | null;
  type: 'file' | 'dir';
}

export interface IndexEntry {
  [field: string]: unknown;
}

export interface IndexData {
  [id: string]: IndexEntry;
}

export type ImportExportFormat = 'json' | 'csv';

export interface ImportOptions {
  format?: ImportExportFormat;
  clear?: boolean;
  idField?: string;
}

export interface ExportOptions {
  format?: ImportExportFormat;
  filter?: Filter<Record<string, unknown>>;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  path: string;
  content?: string | Buffer;
  binary?: boolean;
}

export interface PathCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
  url: string;
}

export interface Git3Document {
  _id: string;
  [key: string]: unknown;
}
