import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { callBridge } from '../../sage-bridge/bridge-client.js';
import type { SageCompany, SageTransaction, PaginatedResponse } from '../../types/domain.js';

// Zod schema for query param validation
const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['txDate', 'reference', 'description', 'amountPence', 'txType']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Fastify plugin: GET /companies/:companyId/transactions
 * Returns paginated transactions for a given company.
 * Registered with { prefix: '/api' } so the full path is GET /api/companies/:companyId/transactions.
 */
export async function transactionsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { companyId: string };
    Querystring: Record<string, string>;
  }>('/companies/:companyId/transactions', async (request, reply) => {
    const companyId = Number(request.params.companyId);

    // Validate query params with Zod
    const parseResult = transactionQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Parâmetros inválidos',
        details: parseResult.error.flatten(),
      });
    }
    const filters = parseResult.data;

    try {
      // First get company list to find the company path for the given ID
      const companies = await callBridge<SageCompany[]>({ type: 'LIST_COMPANIES' });
      const company = companies.find((c) => c.id === companyId);

      if (!company) {
        return reply.status(404).send({
          error: `Empresa com ID ${companyId} não encontrada`,
        });
      }

      // Call bridge for transactions
      const result = await callBridge<{ data: SageTransaction[]; total: number }>({
        type: 'READ_TRANSACTIONS',
        companyPath: company.sagePath,
        filters,
      });

      const response: PaginatedResponse<SageTransaction> = {
        rows: result.data,
        total: result.total,
        page: filters.page,
        pageSize: filters.pageSize,
      };

      return reply.send(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const code = (error as NodeJS.ErrnoException).code;

      return reply.status(502).send({
        error: 'Não foi possível ligar ao Sage',
        details: error.message,
        ...(code ? { code } : {}),
      });
    }
  });
}
