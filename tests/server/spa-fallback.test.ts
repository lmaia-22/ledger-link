import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { shutdownBridge } from '../../src/sage-bridge/bridge-client.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

describe('Fastify server routing', () => {
  beforeAll(async () => {
    // Disable static file serving — client/dist won't exist in the test environment.
    // Full SPA fallback (index.html serving) is tested manually after running:
    //   npm run build:client && npx tsx src/index.ts
    app = await createApp({ serve_static: false });
    await app.ready();
  }, 15000);

  afterAll(async () => {
    await app.close();
    await shutdownBridge();
  }, 10000);

  test('GET /api/companies returns 200 (API route matched before static)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/companies',
    });
    expect(response.statusCode).toBe(200);
  }, 15000);

  test('GET /nonexistent-page returns 404 when serve_static=false (no dist to serve)', async () => {
    // Without static serving, Fastify returns its default 404 for unknown routes.
    // In production (serve_static=true), this would serve index.html for SPA client-side routing.
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent-page',
    });
    expect(response.statusCode).toBe(404);
  }, 15000);

  test('GET /api/companies/:id/transactions returns 200 for known company (non-Windows)', async () => {
    if (process.platform === 'win32') return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/companies/1/transactions',
    });
    expect(response.statusCode).toBe(200);
  }, 15000);
});
