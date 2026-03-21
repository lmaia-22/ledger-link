export interface SageCompany {
  id: number;
  sagePath: string;
  name: string;
  isConnected: boolean;
  connectedAt: Date | null;
}

export interface SageTransaction {
  id: number;
  companyId: number;
  sageTxRef: string;
  txDate: Date;
  reference: string | null;
  description: string | null;
  amountPence: number; // CRITICAL: integer pence, never float
  txType: string | null;
  importedAt: Date;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionFilters {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: 'txDate' | 'reference' | 'description' | 'amountPence' | 'txType';
  sortOrder?: 'asc' | 'desc';
}
