/**
 * Bridge Host — runs ONLY in the child process spawned by bridge-client.ts via fork().
 *
 * This file handles IPC messages from the parent Fastify process, executes Sage SDO
 * COM calls (Windows only), and sends typed responses back over process.send().
 *
 * On non-Windows platforms it returns mock data for development.
 * On Windows it uses winax (must be installed manually: npm install winax)
 * to call the Sage 50 SDO COM API following the open-per-operation lifecycle.
 */
import { execSync } from 'node:child_process';
import { toPence } from './pence.js';
import type { BridgeRequest, BridgeResponse } from './types.js';
import type { SageCompany, SageTransaction, TransactionFilters } from '../types/domain.js';

const IS_WINDOWS = process.platform === 'win32';

// ─── Registry ProgID Detection (Windows only) ────────────────────────────────

/**
 * Detects the installed Sage 50 SDO ProgID from the Windows registry.
 * Returns something like "SDOEngine.32" — never hard-coded.
 * Throws if Sage SDO is not found.
 */
function detectSageProgId(): string {
  // Try 32-bit path first (Wow6432Node, works on 64-bit Windows)
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Wow6432Node\\Sage\\Line 50\\SDO" /v Current',
      { encoding: 'utf8' }
    );
    const match = out.match(/Current\s+REG_SZ\s+(SDOEngine\.\d+)/i);
    if (match) return match[1];
  } catch {
    // Not found at Wow6432Node path, try native 64-bit path
  }

  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Sage\\Line 50\\SDO" /v Current',
      { encoding: 'utf8' }
    );
    const match = out.match(/Current\s+REG_SZ\s+(SDOEngine\.\d+)/i);
    if (match) return match[1];
  } catch {
    // Not found at native path either
  }

  throw new Error('Sage SDO not found in registry. Is Sage 50 Accounts installed?');
}

// ─── Mock Data (non-Windows / dev) ───────────────────────────────────────────

const MOCK_COMPANIES: SageCompany[] = [
  { id: 1, sagePath: '/mock/path/a', name: 'Empresa Demo A', isConnected: false, connectedAt: null },
  { id: 2, sagePath: '/mock/path/b', name: 'Empresa Demo B', isConnected: false, connectedAt: null },
  { id: 3, sagePath: '/mock/path/c', name: 'Empresa Demo C', isConnected: false, connectedAt: null },
];

const PORTUGUESE_DESCRIPTIONS = [
  'Pagamento fornecedor',
  'Recebimento cliente',
  'Taxa bancaria',
  'Fatura telecomunicacoes',
  'Pagamento salarios',
  'Renda escritorio',
  'Material escritorio',
  'Seguro empresa',
  'Publicidade online',
  'Servicos contabilidade',
  'Reembolso despesas',
  'Juro credito bancario',
  'Comissao bancaria',
  'Pagamento IVA',
  'Transferencia interna',
  'Compra equipamento',
  'Manutencao sistemas',
  'Servicos de limpeza',
  'Agua e saneamento',
  'Eletricidade',
];

const TX_TYPES = ['SA', 'PA', 'BP', 'SC', 'PC'];

function generateMockTransactions(companyId: number): SageTransaction[] {
  const now = new Date();
  const transactions: SageTransaction[] = [];

  // Generate 25 mock transactions within last 90 days
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const txDate = new Date(now);
    txDate.setDate(txDate.getDate() - daysAgo);

    const floatAmount = (Math.random() * 5000 + 10) * (Math.random() > 0.3 ? 1 : -1);

    transactions.push({
      id: companyId * 1000 + i,
      companyId,
      sageTxRef: `TX${companyId}-${String(i + 1).padStart(4, '0')}`,
      txDate,
      reference: `REF-${String(i + 1).padStart(5, '0')}`,
      description: PORTUGUESE_DESCRIPTIONS[i % PORTUGUESE_DESCRIPTIONS.length],
      amountPence: toPence(floatAmount),
      txType: TX_TYPES[i % TX_TYPES.length],
      importedAt: new Date(),
    });
  }

  // Sort by date descending
  transactions.sort((a, b) => b.txDate.getTime() - a.txDate.getTime());
  return transactions;
}

// ─── Stub / mock implementations ─────────────────────────────────────────────

function listCompanies(): SageCompany[] {
  if (!IS_WINDOWS) {
    // Return mock data for development on macOS/Linux
    return MOCK_COMPANIES;
  }

  // TODO: implement with winax on Windows
  // const progId = detectSageProgId();
  // const engine = new winax.Object(progId);
  // try {
  //   const datasets = engine.DataSets;
  //   // Enumerate company datasets, return list
  //   return [];
  // } finally {
  //   try { engine.Quit(); } catch {}
  // }
  return [];
}

function readTransactions(
  companyPath: string,
  filters: TransactionFilters
): { data: SageTransaction[]; total: number } {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  if (!IS_WINDOWS) {
    // Mock data — find company by path or use company id 1
    const company = MOCK_COMPANIES.find((c) => c.sagePath === companyPath) ?? MOCK_COMPANIES[0];
    let allRows = generateMockTransactions(company.id);

    // Apply date filters
    if (filters.from) {
      const fromDate = new Date(filters.from);
      allRows = allRows.filter((tx) => tx.txDate >= fromDate);
    }
    if (filters.to) {
      const toDate = new Date(filters.to);
      allRows = allRows.filter((tx) => tx.txDate <= toDate);
    }

    // Apply search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      allRows = allRows.filter(
        (tx) =>
          tx.reference?.toLowerCase().includes(q) ||
          tx.description?.toLowerCase().includes(q) ||
          tx.sageTxRef.toLowerCase().includes(q)
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      const dir = filters.sortOrder === 'desc' ? -1 : 1;
      allRows.sort((a, b) => {
        const aVal = a[filters.sortBy as keyof SageTransaction];
        const bVal = b[filters.sortBy as keyof SageTransaction];
        if (aVal === null || aVal === undefined) return dir;
        if (bVal === null || bVal === undefined) return -dir;
        if (aVal instanceof Date && bVal instanceof Date) return dir * (aVal.getTime() - bVal.getTime());
        if (typeof aVal === 'number' && typeof bVal === 'number') return dir * (aVal - bVal);
        return dir * String(aVal).localeCompare(String(bVal));
      });
    }

    const total = allRows.length;
    const offset = (page - 1) * pageSize;
    const data = allRows.slice(offset, offset + pageSize);
    return { data, total };
  }

  // Windows: real SDO implementation following open-per-operation pattern (Pattern 2)
  // TODO: implement with winax on Windows
  // const progId = detectSageProgId();
  // const engine = new winax.Object(progId);
  // try {
  //   const ws = engine.Workspaces.Add('LedgerLink');
  //   ws.Connect(companyPath, '', '', 'LedgerLink');
  //   const ds = ws.DataSets.Item('AUDIT_JOURNAL');
  //   const allRows: SageTransaction[] = [];
  //   ds.MoveFirst();
  //   while (!ds.EOF) {
  //     allRows.push({
  //       id: ds.DataFields.Item('AUDIT_JOURNAL_NUMBER').Value,
  //       companyId: 0, // resolved by parent
  //       sageTxRef: String(ds.DataFields.Item('AUDIT_JOURNAL_NUMBER').Value),
  //       txDate: new Date(ds.DataFields.Item('DATE').Value),
  //       reference: ds.DataFields.Item('REFERENCE').Value || null,
  //       description: ds.DataFields.Item('DETAILS').Value || null,
  //       amountPence: toPence(parseFloat(ds.DataFields.Item('NET_AMOUNT').Value)),
  //       txType: ds.DataFields.Item('TYPE').Value || null,
  //       importedAt: new Date(),
  //     });
  //     ds.MoveNext();
  //   }
  //   ws.Disconnect();
  //   const total = allRows.length;
  //   const offset = (page - 1) * pageSize;
  //   return { data: allRows.slice(offset, offset + pageSize), total };
  // } finally {
  //   try { engine.Workspaces.Remove('LedgerLink'); } catch {}
  // }
  return { data: [], total: 0 };
}

// ─── IPC Message Handler ──────────────────────────────────────────────────────

process.on('message', async (req: BridgeRequest & { type: string }) => {
  // Handle shutdown signal (no id)
  if (req.type === 'SHUTDOWN') {
    process.exit(0);
  }

  try {
    if (req.type === 'PING') {
      const response: BridgeResponse = { id: req.id, ok: true, type: 'PONG' };
      process.send!(response);
    } else if (req.type === 'LIST_COMPANIES') {
      const data = listCompanies();
      const response: BridgeResponse = { id: req.id, ok: true, type: 'COMPANIES', data };
      process.send!(response);
    } else if (req.type === 'READ_TRANSACTIONS') {
      const { data, total } = readTransactions(req.companyPath, req.filters);
      const response: BridgeResponse = { id: req.id, ok: true, type: 'TRANSACTIONS', data, total };
      process.send!(response);
    } else {
      const response: BridgeResponse = {
        id: (req as { id: string }).id,
        ok: false,
        error: `Unknown request type: ${req.type}`,
      };
      process.send!(response);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const response: BridgeResponse = {
      id: (req as { id: string }).id,
      ok: false,
      error: error.message,
      code: (error as NodeJS.ErrnoException).code,
    };
    process.send!(response);
  }
});

// Keep process alive (it's driven by IPC messages from parent)
// This line intentionally prevents the child from exiting on empty event loop
// when process.on('message') is the only handler
process.on('disconnect', () => {
  // Parent disconnected — clean up and exit
  process.exit(0);
});

// Export for testing purposes (not used in normal bridge operation)
export { detectSageProgId, listCompanies, readTransactions };
