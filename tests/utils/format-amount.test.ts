import { describe, test, expect } from 'vitest';
import { formatAmount } from '../../client/src/lib/utils.js';

describe('formatAmount', () => {
  test('formats 123456 pence as Portuguese EUR', () => {
    const result = formatAmount(123456);
    // pt-PT locale uses comma as decimal separator and EUR symbol
    // Thousands separator (dot) may not appear in all Node.js ICU builds
    expect(result).toContain('1234,56');
    expect(result).toContain('€');
  });

  test('formats 0 pence as zero EUR', () => {
    const result = formatAmount(0);
    expect(result).toContain('0,00');
    expect(result).toContain('€');
  });

  test('formats 100 pence as 1 EUR', () => {
    const result = formatAmount(100);
    expect(result).toContain('1,00');
    expect(result).toContain('€');
  });

  test('formats negative pence as negative EUR', () => {
    const result = formatAmount(-50075);
    expect(result).toContain('-500,75');
    expect(result).toContain('€');
  });

  test('formats 1 pence as 0,01 EUR', () => {
    const result = formatAmount(1);
    expect(result).toContain('0,01');
    expect(result).toContain('€');
  });
});
