import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { companiesRoutes } from './api/routes/companies.js';
import { transactionsRoutes } from './api/routes/transactions.js';

/**
 * Create and configure the Fastify application.
 * API routes are registered first (under /api prefix) and matched before the static wildcard.
 * In production, Vite's dist/ output is served as a SPA with index.html fallback for all
 * unmatched routes (client-side routing).
 *
 * @param opts.serve_static - Set to false to skip static file serving (useful in tests)
 */
export async function createApp(opts?: { serve_static?: boolean }): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: true });

  // API routes (registered first — matched before static wildcard)
  await app.register(companiesRoutes, { prefix: '/api' });
  await app.register(transactionsRoutes, { prefix: '/api' });

  // Serve Vite build output in production
  if (opts?.serve_static !== false) {
    const distPath = path.join(import.meta.dirname, '../client/dist');
    try {
      await app.register(staticPlugin, {
        root: distPath,
        wildcard: false,
      });
      // SPA catch-all — sends index.html for all unmatched routes (client-side routing)
      app.setNotFoundHandler((_req, reply) => {
        reply.sendFile('index.html');
      });
    } catch {
      // client/dist may not exist in dev mode — that's OK
      app.log.warn('client/dist not found, skipping static file serving');
    }
  }

  return app;
}
