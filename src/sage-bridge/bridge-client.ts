import { fork, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import type { BridgeRequest, BridgeResponse } from './types.js';

// Module-level state: single forked child and pending promise map
let child: ChildProcess | null = null;
const pending = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/**
 * Ensure the bridge child process is running.
 * If it has exited or was never started, fork a new one and wire up message handlers.
 */
export function ensureBridge(): ChildProcess {
  if (!child || child.exitCode !== null) {
    // Resolve bridge host path: prefer .ts (dev/vitest) over .js (production build)
    const bridgeHostJsPath = new URL('./bridge-host.js', import.meta.url).pathname;
    const bridgeHostTsPath = new URL('./bridge-host.ts', import.meta.url).pathname;
    const useTsx = existsSync(bridgeHostTsPath) && !existsSync(bridgeHostJsPath);
    const bridgeHostPath = useTsx ? bridgeHostTsPath : bridgeHostJsPath;

    // In dev mode use tsx to execute the TypeScript bridge host directly
    const forkOptions = useTsx
      ? { execPath: process.execPath, execArgv: ['--import', 'tsx'] }
      : {};

    child = fork(bridgeHostPath, [], forkOptions);

    child.on('message', (msg: BridgeResponse) => {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.ok) {
        // Extract payload based on response type
        if (msg.type === 'PONG') {
          entry.resolve(msg);
        } else if (msg.type === 'COMPANIES') {
          entry.resolve(msg.data);
        } else if (msg.type === 'TRANSACTIONS') {
          entry.resolve({ data: msg.data, total: msg.total });
        } else {
          entry.resolve(msg);
        }
      } else {
        const err = Object.assign(new Error(msg.error), { code: msg.code });
        entry.reject(err);
      }
    });

    child.on('exit', (_code, _signal) => {
      // Reject all pending promises when bridge crashes
      for (const [id, entry] of pending.entries()) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Bridge process crashed'));
        pending.delete(id);
      }
      child = null;
    });
  }
  return child;
}

/**
 * Send a typed IPC request to the bridge host and return a Promise for the result.
 * A UUID is generated per call for request/response correlation.
 */
export function callBridge<T>(
  req: Omit<BridgeRequest, 'id'>,
  timeoutMs = 30000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Bridge timeout after ${timeoutMs}ms for request type: ${req.type}`));
    }, timeoutMs);

    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
    });

    const bridgeChild = ensureBridge();
    bridgeChild.send({ ...req, id });
  });
}

/**
 * Gracefully shut down the bridge child process.
 * Sends SHUTDOWN message, waits up to 5s, then force-kills.
 */
export async function shutdownBridge(): Promise<void> {
  if (!child) return;

  // Reject all pending immediately
  for (const [id, entry] of pending.entries()) {
    clearTimeout(entry.timer);
    entry.reject(new Error('Bridge is shutting down'));
    pending.delete(id);
  }

  const childRef = child;
  child = null;

  return new Promise<void>((resolve) => {
    const forceKillTimer = setTimeout(() => {
      childRef.kill('SIGKILL');
      resolve();
    }, 5000);

    childRef.once('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    // Send shutdown signal — child process should exit cleanly
    try {
      childRef.send({ type: 'SHUTDOWN' });
    } catch {
      // Process may already be dead
      clearTimeout(forceKillTimer);
      resolve();
    }
  });
}
