import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function loadEnv(filePath) {
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnv(join(root, '.env'));

const required = ['GIT3_TOKEN', 'GIT3_OWNER', 'GIT3_REPO'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const { Git3 } = await import(pathToFileURL(join(root, 'packages/core/dist/index.mjs')).href);
const db = new Git3({ debug: true });

function ok(label, detail) {
  console.log(`OK  ${label}${detail ? ` — ${detail}` : ''}`);
}

try {
  console.log(`Using ${process.env.GIT3_OWNER}/${process.env.GIT3_REPO}\n`);

  const health = await db.health();
  ok('health', `${health.owner}/${health.repo} @ ${health.branch} (${health.rateLimit.remaining}/${health.rateLimit.limit} remaining)`);

  const users = db.collection('users');
  const stamp = Date.now();
  const inserted = await users.insertOne({
    name: 'Ada Lovelace',
    email: `ada-smoke-${stamp}@example.com`,
    plan: 'pro',
    source: 'git3-smoke-test',
  });
  ok('insertOne', `_id=${inserted._id}`);

  const found = await users.findOne({ email: inserted.email });
  if (!found || found._id !== inserted._id) {
    throw new Error('findOne did not return the inserted document');
  }
  ok('findOne', found.name);

  const updated = await users.updateOne(
    { _id: inserted._id },
    { $set: { plan: 'enterprise' } }
  );
  if (!updated || updated.plan !== 'enterprise') {
    throw new Error('updateOne did not apply $set');
  }
  ok('updateOne', `plan=${updated.plan}`);

  const listed = await users.find({ source: 'git3-smoke-test' }).limit(5).toArray();
  ok('find', `${listed.length} matching document(s)`);

  const kv = db.kv();
  await kv.set('smoke:lastRun', stamp);
  const lastRun = await kv.get('smoke:lastRun');
  if (lastRun !== stamp) throw new Error('kv get/set mismatch');
  ok('kv set/get', String(lastRun));

  const deleted = await users.deleteOne({ _id: inserted._id });
  if (!deleted) throw new Error('deleteOne failed');
  ok('deleteOne', 'cleaned up smoke document');

  console.log('\nSmoke test passed.');
} catch (err) {
  console.error('\nSmoke test failed:', err);
  process.exit(1);
}
