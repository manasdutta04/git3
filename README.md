# git3

**Free MongoDB-like database on GitHub.**

git3 turns a private GitHub repository into your database — collections, documents, queries — with zero infrastructure cost. MIT open source.

```bash
npm install git3
```

## 3-step setup

1. **Create a GitHub PAT** at [github.com/settings/tokens](https://github.com/settings/tokens)  
   - Classic: `repo` scope  
   - Fine-grained: **Contents** Read & Write

2. **Add to `.env`:**

```env
GIT3_TOKEN=ghp_xxxxxxxxxxxx
GIT3_OWNER=your-username
GIT3_REPO=my-app-db
```

3. **Use in your app:**

```ts
import { Git3 } from 'git3';

const db = new Git3(); // reads env; auto-creates private repo if missing

const users = db.collection('users');

await users.insertOne({ name: 'Ada', email: 'ada@example.com' });
const ada = await users.findOne({ email: 'ada@example.com' });
await users.updateOne({ email: 'ada@example.com' }, { $set: { plan: 'pro' } });
```

Your **code repo** and **data repo** stay separate. Data is stored as JSON in the GitHub repo you configure.

## Studio (Compass-like GUI)

```bash
npm install git3 git3-studio
npx git3 studio
```

Opens `http://localhost:3847` — browse collections, edit documents, view KV keys. Runs locally only; no signup.

## API overview

| MongoDB-style | git3 |
|---------------|------|
| `insertOne(doc)` | Create document (auto `_id`) |
| `insertMany(docs)` | Batch insert (single commit) |
| `findOne(filter)` | Find first match |
| `find(filter).sort().limit().toArray()` | Query with cursor |
| `updateOne(filter, { $set })` | Partial update |
| `deleteOne(filter)` | Delete document |
| `db.kv()` | Key-value store |
| `db.storage()` | File upload/download |
| `db.health()` | Connection + rate limit |

### Query operators

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$contains`, `$startsWith`, `$endsWith`

### Schema validation

```ts
import { Git3, Schema } from 'git3';

const users = db.collection('users', {
  schema: {
    name: Schema.string().required().minLength(2).build(),
    email: Schema.string().email().required().build(),
    plan: Schema.string().enum(['free', 'pro']).default('free').build(),
  },
});
```

### Encryption (optional)

```env
GIT3_ENCRYPTION_ENABLED=true
GIT3_ENCRYPTION_KEY=your-64-char-hex-key
```

## Data layout (your GitHub repo)

```
my-app-db/
├── collections/
│   └── users/
│       ├── _index.json
│       └── {id}.json
├── kv/store.json
└── storage/
```

## Free — with honest limits

| Free | Limits |
|------|--------|
| git3 is MIT, no billing | 5,000 GitHub API calls/hour |
| GitHub stores your data | ~200–500ms per uncached read |
| Full git history on every write | Best for MVPs & side projects |

## Import / export

```ts
await db.import('users', './backup/users.json');
await db.export('users', './backup/users.csv', { format: 'csv' });
```

## When to use git3

**Good for:** MVPs, hackathons, side projects, internal tools, serverless apps with low traffic.

**Not for:** High-traffic production, sub-10ms latency, complex aggregations.

## License

MIT
