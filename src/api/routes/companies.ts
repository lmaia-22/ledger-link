import type { FastifyInstance } from 'fastify';
import { callBridge } from '../../sage-bridge/bridge-client.js';
import type { SageCompany } from '../../types/domain.js';

/**
 * Fastify plugin: GET /companies
 * Returns the list of Sage companies discovered from the bridge.
 * Registered with { prefix: '/api' } so the full path is GET /api/companies.
 */
export async function companiesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/companies', async (_request, reply) => {
    const companies = await callBridge<SageCompany[]>({ type: 'LIST_COMPANIES' });
    return reply.send(companies);
  });
}
