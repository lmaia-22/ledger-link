import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { shutdownBridge } from '../../src/sage-bridge/bridge-client.js';
import type { FastifyInstance } from 'fastify';
import type { PaginatedResponse, SageCompany, SageTransaction } from '../../src/types/domain.js';

let app: FastifyInstance;

describe('API routes', () => {
  beforeAll(async () => {
    // Create app without static serving (no client/dist in tests)
    app = await createApp({ serve_static: false });
    await app.ready();
  }, 15000);

  afterAll(async () => {
    await app.close();
    await shutdownBridge();
  }, 10000);

  describe('GET /api/companies', () => {
    test('returns 200 with an array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/companies',
      });

      expect(response.statusCode).toBe(200);
      const companies = JSON.parse(response.body) as SageCompany[];
      expect(Array.isArray(companies)).toBe(true);
    }, 15000);

    test('returns companies with expected fields on non-Windows', async () => {
      if (process.platform === 'win32') return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/companies',
      });

      const companies = JSON.parse(response.body) as SageCompany[];
      expect(companies.length).toBe(3);
      expect(companies[0]).toHaveProperty('id');
      expect(companies[0]).toHaveProperty('name');
      expect(companies[0]).toHaveProperty('sagePath');
    }, 15000);
  });

  describe('GET /api/companies/:id/transactions', () => {
    test('returns 200 with PaginatedResponse shape for valid company', async () => {
      if (process.platform === 'win32') return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/companies/1/transactions',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body) as PaginatedResponse<SageTransaction>;
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(Array.isArray(data.rows)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(typeof data.page).toBe('number');
      expect(typeof data.pageSize).toBe('number');
    }, 15000);

    test('respects page and pageSize query params', async () => {
      if (process.platform === 'win32') return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/companies/1/transactions?page=1&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body) as PaginatedResponse<SageTransaction>;
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(10);
      expect(data.rows.length).toBeLessThanOrEqual(10);
    }, 15000);

    test('rows contain amountPence as integer number (not float string)', async () => {
      if (process.platform === 'win32') return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/companies/1/transactions',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body) as PaginatedResponse<SageTransaction>;
      expect(data.rows.length).toBeGreaterThan(0);

      for (const row of data.rows) {
        expect(typeof row.amountPence).toBe('number');
        // Must be an integer (no fractional pence)
        expect(Number.isInteger(row.amountPence)).toBe(true);
      }
    }, 15000);

    test('returns 404 for non-existent company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/companies/9999/transactions',
      });

      expect(response.statusCode).toBe(404);
    }, 15000);

    test('returns 400 for invalid query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/companies/1/transactions?pageSize=999',
      });

      expect(response.statusCode).toBe(400);
    }, 15000);
  });
});
