import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCompanies } from '@/lib/api';

function IndexComponent() {
  const navigate = useNavigate();
  const { data: companies, isLoading, isError } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  });

  useEffect(() => {
    if (companies && companies.length > 0) {
      void navigate({
        to: '/companies/$companyId/transactions',
        params: { companyId: String(companies[0].id) },
        replace: true,
      });
    }
  }, [companies, navigate]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (isError || (companies && companies.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground text-sm">
          Nenhuma empresa encontrada. Verifique a ligacao ao Sage.
        </p>
      </div>
    );
  }

  return null;
}

export const Route = createFileRoute('/')({
  component: IndexComponent,
});
