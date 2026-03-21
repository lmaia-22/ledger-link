import { describe, test, expect } from 'vitest';
import { toPence } from '../../src/sage-bridge/pence.js';

describe('toPence', () => {
  test('converts 115.10 to 11510', () => {
    expect(toPence(115.10)).toBe(11510);
  });

  test('converts 0.01 to 1', () => {
    expect(toPence(0.01)).toBe(1);
  });

  test('converts 1234.56 to 123456', () => {
    expect(toPence(1234.56)).toBe(123456);
  });

  test('handles IEEE 754 edge case: 0.1 + 0.2 rounds to 30', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    expect(toPence(0.1 + 0.2)).toBe(30);
  });

  test('result is always an integer', () => {
    expect(Number.isInteger(toPence(99.99))).toBe(true);
  });
});
