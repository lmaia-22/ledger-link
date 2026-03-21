import type { SageCompany, PaginatedResponse, SageTransaction, TransactionFilters } from '../../../src/types/domain.js';

const API_BASE = '/api';

export async function fetchCompanies(): Promise<SageCompany[]> {
  const res = await fetch(`${API_BASE}/companies`);
  if (!res.ok) throw new Error(`Failed to fetch companies: ${res.status}`);
  return res.json();
}

export async function fetchTransactions(
  companyId: number,
  filters: TransactionFilters = {}
): Promise<PaginatedResponse<SageTransaction>> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  const res = await fetch(`${API_BASE}/companies/${companyId}/transactions?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return res.json();
}
