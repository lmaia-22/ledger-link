import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { TransactionFilters } from '../../../../../src/types/domain.js';
import { fetchTransactions } from '../../../lib/api';
import { TransactionsTable } from '../../../components/TransactionsTable';
import { TransactionsError } from '../../../components/TransactionsError';
import { TransactionsSkeleton } from '../../../components/TransactionsSkeleton';
import { TransactionsEmpty } from '../../../components/TransactionsEmpty';
import { TransactionsFilters } from '../../../components/TransactionsFilters';

export const Route = createFileRoute('/companies/$companyId/transactions')({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { companyId } = Route.useParams();
  const numericId = Number(companyId);

  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});

  // Build query filters from state
  const queryFilters: TransactionFilters = {
    page,
    pageSize: 50,
    ...filters,
    sortBy: sorting[0]?.id as TransactionFilters['sortBy'],
    sortOrder: sorting[0]?.desc ? 'desc' : sorting[0] ? 'asc' : undefined,
  };

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['transactions', numericId, page, sorting, filters],
    queryFn: () => fetchTransactions(numericId, queryFilters),
    enabled: !!numericId,
    placeholderData: (prev) => prev, // Keep previous data while fetching next page
  });

  // Reset page to 1 when filters change
  const handleFiltersChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const hasFilters = !!(filters.search || filters.from || filters.to);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <h1 className="text-xl font-semibold leading-tight">Transaccoes</h1>

      {/* Filter bar */}
      <TransactionsFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Content area: loading / error / empty / table */}
      {isLoading && !data ? (
        <TransactionsSkeleton />
      ) : error && !data ? (
        <TransactionsError error={error as Error} onRetry={() => refetch()} />
      ) : data && data.rows.length === 0 ? (
        <TransactionsEmpty hasFilters={hasFilters} />
      ) : data ? (
        <TransactionsTable
          data={data.rows}
          total={data.total}
          page={page}
          pageSize={50}
          sorting={sorting}
          onPageChange={setPage}
          onSortingChange={setSorting}
        />
      ) : null}
    </div>
  );
}
