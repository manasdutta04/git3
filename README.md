# git3

**Free MongoDB-like database on GitHub.** No servers. Your data stays in a private repo you own.

## Use it

```bash
npx git3 studio
```

The browser opens. Paste:

1. A GitHub token ([create one](https://github.com/settings/tokens) with the `repo` scope)
2. Your GitHub username
3. A repo name (`my-app-db` is fine)

Click **Connect**. git3 writes a local `.env` and creates the private repo if it is missing. Then you can browse collections in Studio.

The token never leaves your machine.

## Use it in your app

Same `.env`. Then:

```ts
import { Git3 } from 'git3';

const db = new Git3();
const users = db.collection('users');

await users.add({ name: 'Ada', email: 'ada@example.com' });
const ada = await users.get('...');        // by _id
const found = await users.findOne({ email: 'ada@example.com' });
await users.set(ada._id, { plan: 'pro' });
await users.remove(ada._id);
```

Install for apps: `npm install git3`. Studio: `npm install git3 git3-studio`.

## Advanced

MongoDB-style methods still work: `insertOne`, `findOne`, `updateOne({ $set })`, `find().sort().limit().toArray()`.

| Method | Meaning |
|--------|---------|
| `add` / `insertOne` | Create |
| `get` / `findById` | Read by id |
| `find` / `findOne` | Query |
| `set` / `updateOne` | Update fields |
| `remove` / `deleteOne` | Delete |
| `db.kv()` | Key-value |
| `db.storage()` | Files |

### Query operators

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$contains`, `$startsWith`, `$endsWith`

### Schema, encryption, import

See collection `schema` options, `GIT3_ENCRYPTION_KEY`, and `db.import` / `db.export`.

## Limits

git3 is free (MIT). GitHub allows about 5,000 API calls/hour. Best for MVPs, side projects, and internal tools — not high-traffic production.

## License

MIT
