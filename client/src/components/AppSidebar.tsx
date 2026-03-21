import { useState, useEffect } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchCompanies } from '@/lib/api';

const SIDEBAR_COLLAPSED_KEY = 'ledger-link:sidebar-collapsed';

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  });

  const isSageConnected = companies.some((c) => c.isConnected);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage may be unavailable
      }
      return next;
    });
  };

  const getActiveCompanyId = (): number | null => {
    const match = currentPath.match(/\/companies\/(\d+)\//);
    return match ? parseInt(match[1], 10) : null;
  };

  const activeCompanyId = getActiveCompanyId();

  const handleCompanyClick = (companyId: number) => {
    void navigate({ to: '/companies/$companyId/transactions', params: { companyId: String(companyId) } });
  };

  const isTransactionsActive = currentPath.includes('/transactions');

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'flex flex-col h-full bg-secondary border-r border-border transition-[width] duration-200 ease-out overflow-hidden shrink-0',
          isCollapsed ? 'w-[52px]' : 'w-[240px]'
        )}
      >
        {/* App Header */}
        <div className="flex items-center justify-between h-14 px-3 shrink-0">
          {!isCollapsed && (
            <span className="font-semibold text-sm text-foreground truncate">Ledger Link</span>
          )}
          {isCollapsed && <span className="font-semibold text-sm text-foreground">LL</span>}
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-11 h-11 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        <Separator />

        {/* Company List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-2">
            {companies.map((company) => {
              const isActive = company.id === activeCompanyId;
              return (
                <button
                  key={company.id}
                  onClick={() => handleCompanyClick(company.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive && 'bg-accent text-accent-foreground',
                    isCollapsed ? 'justify-center' : ''
                  )}
                  title={isCollapsed ? company.name : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Connection dot */}
                  <span
                    className={cn(
                      'block rounded-full shrink-0',
                      isCollapsed ? 'w-2.5 h-2.5' : 'w-2 h-2',
                      company.isConnected
                        ? 'bg-[hsl(var(--sage-connected))]'
                        : 'bg-[hsl(var(--sage-disconnected))]'
                    )}
                    aria-hidden="true"
                  />
                  {/* Company name — hidden when collapsed */}
                  {!isCollapsed && (
                    <span
                      className={cn('truncate', isActive ? 'font-semibold' : 'font-normal')}
                    >
                      {company.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        {/* Nav Section */}
        <nav className="py-2 shrink-0">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (activeCompanyId) {
                      void navigate({
                        to: '/companies/$companyId/transactions',
                        params: { companyId: String(activeCompanyId) },
                      });
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-center px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isTransactionsActive && 'bg-accent text-accent-foreground'
                  )}
                  aria-label="Transacções"
                  aria-current={isTransactionsActive ? 'page' : undefined}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Transacções</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => {
                if (activeCompanyId) {
                  void navigate({
                    to: '/companies/$companyId/transactions',
                    params: { companyId: String(activeCompanyId) },
                  });
                }
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                isTransactionsActive && 'bg-accent text-accent-foreground'
              )}
              aria-current={isTransactionsActive ? 'page' : undefined}
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span>Transacções</span>
            </button>
          )}
        </nav>

        <Separator />

        {/* Sage Status Footer */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-3 shrink-0',
            isCollapsed ? 'justify-center' : ''
          )}
        >
          <span
            className={cn(
              'block w-2 h-2 rounded-full shrink-0',
              isSageConnected
                ? 'bg-[hsl(var(--sage-connected))]'
                : 'bg-[hsl(var(--sage-disconnected))]'
            )}
            aria-hidden="true"
          />
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">
              {isSageConnected ? 'Sage: Ligado' : 'Sage: Desligado'}
            </span>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
