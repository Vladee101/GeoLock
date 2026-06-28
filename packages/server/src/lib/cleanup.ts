import { query } from '../db/client.ts';

export async function cleanupExpired(): Promise<number> {
  const rows = await query(`
    DELETE FROM drops
    WHERE hard_expires_at < now() OR view_expires_at < now()
    RETURNING id
  `);
  return rows.length;
}

export function startCleanupCron(intervalMs = 10 * 60_000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const n = await cleanupExpired();
      if (n > 0) console.log(`[cleanup] Removed ${n} expired drops`);
    } catch (err) {
      console.error('[cleanup] Error:', err);
    }
  }, intervalMs);
}
