/**
 * Convert a float amount (as returned by Sage SDO) to integer pence.
 * CRITICAL: All monetary values must be stored as integer pence.
 * Math.round handles IEEE 754 floating point edge cases (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */
export function toPence(floatAmount: number): number {
  return Math.round(floatAmount * 100);
}
