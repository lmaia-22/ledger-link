import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Skeleton } from './ui/skeleton';

export function TransactionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="A carregar transaccoes">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Data</TableHead>
            <TableHead className="w-40">Referencia</TableHead>
            <TableHead>Descricao</TableHead>
            <TableHead className="w-32">Tipo</TableHead>
            <TableHead className="w-32 text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-full max-w-xs" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
