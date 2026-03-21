import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import type { TransactionFilters } from '../../../src/types/domain.js';

interface TransactionsFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionsFilters({ filters, onFiltersChange }: TransactionsFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search ?? '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local search in sync if filters are reset externally
  useEffect(() => {
    setSearchValue(filters.search ?? '');
  }, [filters.search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value || undefined });
      }, 300);
    },
    [filters, onFiltersChange]
  );

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, from: e.target.value || undefined });
    },
    [filters, onFiltersChange]
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, to: e.target.value || undefined });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1" style={{ maxWidth: '400px' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          className="pl-9"
          placeholder="Pesquisar referencia ou descricao..."
          value={searchValue}
          onChange={handleSearchChange}
          aria-label="Pesquisar por referencia ou descricao"
        />
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground whitespace-nowrap">De</label>
        <Input
          type="date"
          className="w-40"
          value={filters.from ?? ''}
          onChange={handleFromChange}
          aria-label="Data de inicio do periodo"
          placeholder="Seleccionar periodo"
        />
        <label className="text-sm text-muted-foreground whitespace-nowrap">Ate</label>
        <Input
          type="date"
          className="w-40"
          value={filters.to ?? ''}
          onChange={handleToChange}
          aria-label="Data de fim do periodo"
          placeholder="Seleccionar periodo"
        />
      </div>
    </div>
  );
}
