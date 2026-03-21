import { useState } from 'react';
import { Button } from './ui/button';

interface TransactionsErrorProps {
  error: Error;
  onRetry: () => void;
}

export function TransactionsError({ error, onRetry }: TransactionsErrorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div
      role="alert"
      className="rounded-md border-l-4 border-l-destructive bg-destructive/5 p-6 space-y-3"
    >
      <h2 className="text-lg font-semibold leading-tight">
        Nao foi possivel carregar os dados
      </h2>
      <p className="text-sm text-muted-foreground">
        Ocorreu um erro ao ligar ao Sage. Verifique se o Sage esta aberto e tente novamente.
      </p>

      <div className="flex flex-col gap-2 items-start">
        <Button variant="default" onClick={onRetry}>
          Tentar novamente
        </Button>

        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          onClick={() => setDetailsOpen((prev) => !prev)}
          aria-expanded={detailsOpen}
        >
          Detalhes
        </button>
      </div>

      {detailsOpen && (
        <pre className="mt-2 rounded bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {error.message}
        </pre>
      )}
    </div>
  );
}
