import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Git3 } from 'git3';
import { createRoutes } from './routes.js';

const PORT = Number(process.env.GIT3_STUDIO_PORT || 3847);

export async function startStudio(): Promise<void> {
  const db = new Git3();
  const routes = createRoutes(db);
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const uiPath = join(__dirname, 'ui');
  app.use(express.static(uiPath));

  app.get('/api/health', routes.health);
  app.get('/api/collections', routes.listCollections);
  app.get('/api/collections/:name', routes.listDocuments);
  app.get('/api/collections/:name/:id', routes.getDocument);
  app.post('/api/collections/:name', routes.createDocument);
  app.patch('/api/collections/:name/:id', routes.updateDocument);
  app.delete('/api/collections/:name/:id', routes.deleteDocument);
  app.get('/api/kv', routes.listKv);
  app.post('/api/kv', routes.setKv);
  app.delete('/api/kv/:key', routes.deleteKv);
  app.get('/api/storage', routes.listStorage);

  app.get('*', (_req, res) => {
    res.sendFile(join(uiPath, 'index.html'));
  });

  await new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      console.log(`git3 Studio running at http://localhost:${PORT}`);
      resolve();
    });
  });
}
