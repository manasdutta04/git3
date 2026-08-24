import { Git3 } from 'git3';
import type { Request, Response } from 'express';

export function createRoutes(db: Git3) {
  return {
    health: async (_req: Request, res: Response) => {
      try {
        const health = await db.health();
        res.json(health);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listCollections: async (_req: Request, res: Response) => {
      try {
        const collections = await db.listCollections();
        res.json({ collections });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listDocuments: async (req: Request, res: Response) => {
      try {
        const col = db.collection(req.params.name!);
        const docs = await col.findAll();
        res.json({ documents: docs });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    getDocument: async (req: Request, res: Response) => {
      try {
        const col = db.collection(req.params.name!);
        const doc = await col.findById(req.params.id!);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json({ document: doc });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    createDocument: async (req: Request, res: Response) => {
      try {
        const col = db.collection(req.params.name!);
        const doc = await col.insertOne(req.body);
        res.status(201).json({ document: doc });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateDocument: async (req: Request, res: Response) => {
      try {
        const col = db.collection(req.params.name!);
        const updated = await col.updateOne({ _id: req.params.id! }, { $set: req.body });
        if (!updated) return res.status(404).json({ error: 'Not found' });
        res.json({ document: updated });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteDocument: async (req: Request, res: Response) => {
      try {
        const col = db.collection(req.params.name!);
        const ok = await col.deleteOne({ _id: req.params.id! });
        if (!ok) return res.status(404).json({ error: 'Not found' });
        res.json({ deleted: true });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    listKv: async (_req: Request, res: Response) => {
      try {
        const data = await db.kv().getAll();
        res.json({ kv: data });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    setKv: async (req: Request, res: Response) => {
      try {
        const { key, value } = req.body as { key: string; value: unknown };
        await db.kv().set(key, value);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    listStorage: async (req: Request, res: Response) => {
      try {
        const prefix = (req.query.prefix as string) || '';
        const files = await db.storage().list(prefix);
        res.json({ files });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  };
}
