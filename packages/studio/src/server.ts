import express from 'express';
import multer from 'multer';
import type { Request, Response, Express } from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, Git3 } from '@git3db/db';
import { createRoutes, type StudioSession } from './routes.js';
import { writeGit3Env } from './env-file.js';

export interface StudioOptions {
  port: number;
  serveUi: boolean;
  cors: boolean;
}

function isLocalhost(req: Request): boolean {
  const host = String(req.headers.host || '');
  const hostname = host.split(':')[0] || '';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.endsWith('127.0.0.1');
}

function tryCreateDb(): Git3 | null {
  if (!Git3.isConfigured()) return null;
  try {
    return new Git3();
  } catch (err) {
    if (err instanceof ConfigError) return null;
    throw err;
  }
}

function mountApi(app: Express, session: StudioSession): void {
  const routes = createRoutes(session);

  app.get('/api/status', routes.status);

  app.post('/api/setup', async (req: Request, res: Response) => {
    if (!isLocalhost(req)) {
      res.status(403).json({ error: 'Setup is only allowed from localhost.' });
      return;
    }

    const token = String(req.body?.token || '').trim();
    const owner = String(req.body?.owner || '').trim();
    const repo = String(req.body?.repo || '').trim() || 'my-app-db';
    const branch = String(req.body?.branch || 'main').trim() || 'main';

    if (!token || !owner) {
      res.status(400).json({ error: 'Token and GitHub username are required.' });
      return;
    }

    try {
      const db = new Git3({ token, owner, repo, branch });
      const health = await db.health();
      writeGit3Env({ token, owner, repo, branch });
      process.env.GIT3_TOKEN = token;
      process.env.GIT3_OWNER = owner;
      process.env.GIT3_REPO = repo;
      process.env.GIT3_BRANCH = branch;
      session.db = db;
      res.json({ ok: true, health });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.get('/api/health', routes.health);
  app.get('/api/collections', routes.listCollections);
  app.get('/api/collections/:name', routes.listDocuments);
  app.get('/api/collections/:name/:id/history', routes.documentHistory);
  app.get('/api/collections/:name/:id', routes.getDocument);
  app.post('/api/collections/:name', routes.createDocument);
  app.patch('/api/collections/:name/:id', routes.updateDocument);
  app.delete('/api/collections/:name/:id', routes.deleteDocument);
  app.get('/api/kv', routes.listKv);
  app.post('/api/kv', routes.setKv);
  app.delete('/api/kv/:key', routes.deleteKv);
  app.get('/api/storage/file', routes.downloadStorage);
  app.get('/api/storage', routes.listStorage);
  app.post('/api/storage', upload.single('file'), routes.uploadStorage);
  app.delete('/api/storage', routes.deleteStorage);
}

export async function startStudio(options: Partial<StudioOptions> = {}): Promise<void> {
  const opts: StudioOptions = {
    port: options.port ?? Number(process.env.GIT3_STUDIO_PORT || 3847),
    serveUi: options.serveUi ?? true,
    cors: options.cors ?? false,
  };

  const session: StudioSession = { db: tryCreateDb() };
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json({ limit: '2mb' }));

  if (opts.cors) {
    app.use((req, res, next) => {
      const origin = String(req.headers.origin || '');
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('null') ||
        origin === 'null'
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin === 'null' || !origin ? '*' : origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  mountApi(app, session);

  if (opts.serveUi) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const uiPath = join(__dirname, 'ui');
    app.use(express.static(uiPath));
    app.get('*', (_req, res) => {
      res.sendFile(join(uiPath, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: () => void) => {
    if (err.name === 'MulterError') {
      res
        .status(400)
        .json({
          error: err.message === 'File too large' ? 'File must be 10MB or smaller.' : err.message,
        });
      return;
    }
    res.status(500).json({ error: err.message });
  });

  await new Promise<void>((resolve) => {
    app.listen(opts.port, '127.0.0.1', () => {
      if (opts.serveUi) {
        console.log(`git3 Studio running at http://localhost:${opts.port}`);
      } else {
        console.log(`git3 API serving at http://127.0.0.1:${opts.port}`);
        if (session.db) {
          const info = session.db.info();
          console.log(`database ${info.owner}/${info.repo}`);
        }
      }
      resolve();
    });
  });
}
