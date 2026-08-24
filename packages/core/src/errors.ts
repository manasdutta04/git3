export class Git3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Git3Error';
  }
}

export class ConfigError extends Git3Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class AuthenticationError extends Git3Error {
  constructor(message = 'GitHub token is invalid or missing required scopes.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Git3Error {
  retryAfter: number;
  resetsAt: string;

  constructor(retryAfter: number, resetsAt: string) {
    super(`GitHub API rate limit exceeded. Retry after ${retryAfter}s.`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.resetsAt = resetsAt;
  }
}

export class ConflictError extends Git3Error {
  filePath: string;

  constructor(filePath: string) {
    super(`Concurrent modification detected on ${filePath}.`);
    this.name = 'ConflictError';
    this.filePath = filePath;
  }
}

export class NotFoundError extends Git3Error {
  resource: string;

  constructor(resource: string) {
    super(`Not found: ${resource}`);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class ValidationError extends Git3Error {
  errors: { field: string; message: string }[];

  constructor(message: string, errors: { field: string; message: string }[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class GitHubApiError extends Git3Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}
