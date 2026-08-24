# @git3db/db

**Free MongoDB-like database on GitHub.** No servers. Your data stays in a private repo you own.

**Marketing site (Vercel):** deploy the `web/` folder — Root Directory = `web`.  
**Product (npm):** `npx git3 studio` and `@git3db/db` — Studio UI matches the landing look.

## Start here

```bash
npx git3 studio
```

The browser opens at `http://localhost:3847`. Paste:

1. A GitHub token ([create one](https://github.com/settings/tokens) with the `repo` scope)
2. Your GitHub username
3. A repo name (`my-app-db` is fine)

Click **Connect**. git3 writes a local `.env`. The token never leaves your machine.

## Use it in your app

Same `.env`. Then:

```ts
import { Git3 } from '@git3db/db';

const db = new Git3();
const users = db.collection('users');

await users.add({ name: 'Ada', email: 'ada@example.com' });
const ada = await users.get('...');        // by _id
const found = await users.findOne({ email: 'ada@example.com' });
await users.set(ada!._id, { plan: 'pro' });
await users.remove(ada!._id);
```

```bash
npm install @git3db/db
```

## Update from an older version

`npx` and npm can keep an old copy. To get the latest:

```bash
# CLI / Studio
npx --yes @git3db/studio@latest studio
npx --yes @git3db/studio@latest serve

# In a project that already depends on the packages
npm install @git3db/db@latest
npm install -D @git3db/studio@latest
```

Check what you have:

```bash
npm view @git3db/db version
npm ls @git3db/db
```

If `npx` still runs an old build, clear its cache once: `npx clear-npx-cache`, then run `@latest` again.

## Use it from a website (local)

Token stays in the git3 process — never put it in browser JavaScript.

```bash
npx git3 serve
```

Then open [`templates/web/index.html`](templates/web/index.html) (or any local page that calls `http://127.0.0.1:3850/api/...`).

## Studio

```bash
npm install -D @git3db/studio
npx git3 studio
```

Browse collections, key-value, files, and document **history** (git commits for each JSON file).

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
| `db.storage()` | Files (PNG, PDF, …) |

**Documents vs files:** collections store JSON. Images and other binaries go in `storage/`.

```ts
await db.storage().upload('avatars/ada.png', pngBuffer);
const bytes = await db.storage().download('avatars/ada.png');
```

### Query operators

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$contains`, `$startsWith`, `$endsWith`

### Schema, encryption, import

See collection `schema` options, `GIT3_ENCRYPTION_KEY`, and `db.import` / `db.export`.

## Limits

git3 is free (MIT). GitHub allows about 5,000 API calls/hour. Best for MVPs, side projects, and internal tools — not high-traffic production. Deletes commit through the Git tree API and are durable as of `0.1.2`.

## License

MIT
