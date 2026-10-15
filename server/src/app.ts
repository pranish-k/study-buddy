import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chatRouter } from './routes/chat.js';
import type { Brain } from './types.js';

export function createApp(brain: Brain): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Large enough for a long paste plus history; guardrails trim further before the model sees it.
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, brain: brain.name, model: brain.model });
  });
  app.use('/api', chatRouter(brain));

  // `npm start` serves the built front end from the same origin.
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile('index.html', { root: webDist }));
  }
  return app;
}
