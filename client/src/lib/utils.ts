import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an integer pence amount as Portuguese locale currency string.
 * Example: formatAmount(123456) => "1.234,56 €"
 * CRITICAL: input must be integer pence (e.g., from amountPence column), not a float.
 */
export function formatAmount(pence: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(pence / 100);
}
