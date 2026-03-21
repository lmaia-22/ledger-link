interface TransactionsEmptyProps {
  hasFilters: boolean;
}

export function TransactionsEmpty({ hasFilters }: TransactionsEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      {hasFilters ? (
        <>
          <h2 className="text-lg font-semibold leading-tight">Sem resultados</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Nenhum resultado corresponde aos filtros aplicados. Tente ajustar a pesquisa ou o
            periodo seleccionado.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold leading-tight">Sem transaccoes</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Nao foram encontradas transaccoes para o periodo seleccionado. Ajuste os filtros ou
            verifique a ligacao ao Sage.
          </p>
        </>
      )}
    </div>
  );
}
