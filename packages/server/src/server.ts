import { buildApp } from './app.ts';
import { startCleanupCron } from './lib/cleanup.ts';

const app = await buildApp();
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: '0.0.0.0' });
console.log(`GeoLock server listening on :${port}`);
startCleanupCron();
