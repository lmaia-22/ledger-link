import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { callBridge, shutdownBridge, ensureBridge } from '../../src/sage-bridge/bridge-client.js';
import type { SageCompany } from '../../src/types/domain.js';

// Bridge IPC tests — fork a child process and verify round-trip IPC
// Timeout is generous to allow for bridge startup on CI
describe('bridge-client IPC', () => {
  beforeAll(() => {
    // Ensure bridge is started before tests
    ensureBridge();
  }, 10000);

  afterAll(async () => {
    await shutdownBridge();
  }, 10000);

  test('callBridge PING resolves with PONG response', async () => {
    const response = await callBridge<{ id: string; ok: true; type: 'PONG' }>({ type: 'PING' });
    expect(response).toBeDefined();
    expect(response.ok).toBe(true);
    expect(response.type).toBe('PONG');
  }, 10000);

  test('callBridge LIST_COMPANIES returns an array', async () => {
    const companies = await callBridge<SageCompany[]>({ type: 'LIST_COMPANIES' });
    expect(Array.isArray(companies)).toBe(true);
    // On non-Windows (dev/CI), mock returns 3 companies
    expect(companies.length).toBeGreaterThanOrEqual(0);
  }, 10000);

  test('callBridge LIST_COMPANIES returns companies with expected shape on non-Windows', async () => {
    if (process.platform === 'win32') return; // skip on Windows (real SDO)
    const companies = await callBridge<SageCompany[]>({ type: 'LIST_COMPANIES' });
    expect(companies.length).toBe(3);
    expect(companies[0]).toHaveProperty('id');
    expect(companies[0]).toHaveProperty('sagePath');
    expect(companies[0]).toHaveProperty('name');
    expect(companies[0]).toHaveProperty('isConnected');
  }, 10000);

  test('shutdownBridge resolves without error', async () => {
    await expect(shutdownBridge()).resolves.toBeUndefined();
  }, 10000);
});
