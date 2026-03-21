import { createFileRoute } from '@tanstack/react-router';

function TransactionsComponent() {
  const { companyId } = Route.useParams();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold leading-tight mb-6">Transacções</h1>
      <div className="text-sm text-muted-foreground">
        Tabela de transaccoes
      </div>
      {/* Full TanStack Table implementation comes in Plan 04 */}
      <div className="hidden">{companyId}</div>
    </div>
  );
}

export const Route = createFileRoute('/companies/$companyId/transactions')({
  component: TransactionsComponent,
});
