import type { SageCompany, SageTransaction, TransactionFilters } from '../types/domain.js';

export type BridgeRequest =
  | { id: string; type: 'PING' }
  | { id: string; type: 'LIST_COMPANIES' }
  | { id: string; type: 'READ_TRANSACTIONS'; companyPath: string; filters: TransactionFilters };

export type BridgeResponse =
  | { id: string; ok: true; type: 'PONG' }
  | { id: string; ok: true; type: 'COMPANIES'; data: SageCompany[] }
  | { id: string; ok: true; type: 'TRANSACTIONS'; data: SageTransaction[]; total: number }
  | { id: string; ok: false; error: string; code?: string };
