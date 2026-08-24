import { Git3 } from '@git3db/db';
import type { Request, Response } from 'express';

export interface StudioSession {
  db: Git3 | null;
}

function needsDb(session: StudioSession, res: Response): Git3 | null {
  if (!session.db) {
    res.status(401).json({ error: 'Not connected', needsSetup: true });
    return null;
  }
  return session.db;
}

export function createRoutes(session: StudioSession) {
  return {
    status: async (_req: Request, res: Response) => {
      if (!session.db) {
        res.json({ configured: false });
        return;
      }
      res.json({ configured: true, info: session.db.info() });
    },

    health: async (_req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const health = await db.health();
        res.json(health);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listCollections: async (_req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const collections = await db.listCollections();
        res.json({ collections });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listDocuments: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const col = db.collection(req.params.name!);
        const docs = await col.findAll();
        res.json({ documents: docs });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    getDocument: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const col = db.collection(req.params.name!);
        const doc = await col.get(req.params.id!);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json({ document: doc });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    createDocument: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const col = db.collection(req.params.name!);
        const doc = await col.add(req.body);
        res.status(201).json({ document: doc });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateDocument: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const col = db.collection(req.params.name!);
        const updated = await col.set(req.params.id!, req.body);
        if (!updated) return res.status(404).json({ error: 'Not found' });
        res.json({ document: updated });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteDocument: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const col = db.collection(req.params.name!);
        const ok = await col.remove(req.params.id!);
        if (!ok) return res.status(404).json({ error: 'Not found' });
        res.json({ deleted: true });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listKv: async (_req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const data = await db.kv().getAll();
        res.json({ kv: data });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    setKv: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const { key, value } = req.body as { key: string; value: unknown };
        await db.kv().set(key, value);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteKv: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const key = req.params.key!;
        await db.kv().delete(key);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    listStorage: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const prefix = (req.query.prefix as string) || '';
        const files = await db.storage().list(prefix);
        res.json({ files });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    downloadStorage: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const path = String(req.query.path || '').replace(/^\/+/, '');
        if (!path || path.includes('..')) {
          res.status(400).json({ error: 'Invalid path' });
          return;
        }
        const buf = await db.storage().download(path);
        res.setHeader('Content-Type', contentTypeFor(path));
        res.setHeader('Content-Disposition', `inline; filename="${path.split('/').pop()}"`);
        res.send(buf);
      } catch (err) {
        res.status(404).json({ error: (err as Error).message });
      }
    },

    uploadStorage: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }
        const requested = String(req.body?.path || '').trim();
        const path = (requested || file.originalname).replace(/^\/+/, '');
        if (!path || path.includes('..')) {
          res.status(400).json({ error: 'Invalid path' });
          return;
        }
        await db.storage().upload(path, file.buffer);
        res.status(201).json({ ok: true, path });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteStorage: async (req: Request, res: Response) => {
      const db = needsDb(session, res);
      if (!db) return;
      try {
        const path = String(req.query.path || '').replace(/^\/+/, '');
        if (!path || path.includes('..')) {
          res.status(400).json({ error: 'Invalid path' });
          return;
        }
        await db.storage().delete(path);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },
  };
}

function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  return map[ext || ''] || 'application/octet-stream';
}
