import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatAmount } from '../lib/utils';
import type { SageTransaction } from '../../../src/types/domain.js';

interface TransactionsTableProps {
  data: SageTransaction[];
  total: number;
  page: number;
  pageSize: number;
  sorting: SortingState;
  onPageChange: (page: number) => void;
  onSortingChange: (sorting: SortingState) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return dateFormatter.format(d);
}

const columns: ColumnDef<SageTransaction>[] = [
  {
    accessorKey: 'txDate',
    id: 'txDate',
    header: 'Data',
    cell: ({ getValue }) => formatDate(getValue<Date | string>()),
  },
  {
    accessorKey: 'reference',
    id: 'reference',
    header: 'Referencia',
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      return val ?? '-';
    },
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: 'Descricao',
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return '-';
      return val.length > 60 ? `${val.slice(0, 60)}\u2026` : val;
    },
  },
  {
    accessorKey: 'txType',
    id: 'txType',
    header: 'Tipo',
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      return val ?? '-';
    },
  },
  {
    accessorKey: 'amountPence',
    id: 'amountPence',
    header: () => <span className="block text-right">Valor</span>,
    cell: ({ getValue }) => (
      <span className="block text-right">{formatAmount(getValue<number>())}</span>
    ),
  },
];

export function TransactionsTable({
  data,
  total,
  page,
  pageSize,
  sorting,
  onPageChange,
  onSortingChange,
}: TransactionsTableProps) {
  const pageCount = Math.ceil(total / pageSize);

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    pageCount,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const next = updater({ pageIndex: page - 1, pageSize });
        onPageChange(next.pageIndex + 1);
      }
    },
    onSortingChange: (updater) => {
      if (typeof updater === 'function') {
        onSortingChange(updater(sorting));
      } else {
        onSortingChange(updater);
      }
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const isFirstPage = page <= 1;
  const isLastPage = page >= pageCount;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sorted = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    className={header.id === 'amountPence' ? 'text-right' : undefined}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/50">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">50 por pagina</span>
        <span className="text-sm text-muted-foreground">
          Pagina {page} de {pageCount || 1}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={isFirstPage}
            aria-label="Pagina anterior"
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={isLastPage}
            aria-label="Pagina seguinte"
          >
            Seguinte
          </Button>
        </div>
      </div>
    </div>
  );
}
