import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEYS = ['GIT3_TOKEN', 'GIT3_OWNER', 'GIT3_REPO', 'GIT3_BRANCH'] as const;

export function envFilePath(cwd = process.cwd()): string {
  return join(cwd, '.env');
}

export function writeGit3Env(values: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}, cwd = process.cwd()): string {
  const path = envFilePath(cwd);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const map = new Map<string, string>();

  for (const line of existing.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1));
  }

  map.set('GIT3_TOKEN', values.token);
  map.set('GIT3_OWNER', values.owner);
  map.set('GIT3_REPO', values.repo);
  map.set('GIT3_BRANCH', values.branch || 'main');

  const otherLines = existing.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return true;
    const key = trimmed.split('=')[0]?.trim();
    return !KEYS.includes(key as (typeof KEYS)[number]);
  });

  const git3Block = KEYS.map((key) => `${key}=${map.get(key) ?? ''}`).join('\n');
  const rest = otherLines.filter((l) => l.trim()).join('\n');
  const next = rest ? `${git3Block}\n${rest}\n` : `${git3Block}\n`;
  writeFileSync(path, next, 'utf8');
  return path;
}
