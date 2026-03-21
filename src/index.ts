import { createApp } from './server.js';
import { shutdownBridge } from './sage-bridge/bridge-client.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await createApp();

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...');
  await shutdownBridge();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host });
app.log.info(`Ledger Link server listening on http://${host}:${port}`);
