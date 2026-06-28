import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.ts';
import { verifyKey } from '../lib/key.ts';
import { viewExpiry } from '../lib/expiry.ts';
import { gpsTolerance } from '../lib/spatial.ts';

export async function readDropRoute(app: FastifyInstance) {
  // Tighter than the global default (T-01) — this is the key-guessing
  // surface, and bcrypt cost alone isn't enough friction (ADR-13).
  app.get('/drops/:slug', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { slug } = req.params as any;
    const { lat, lng, key, accuracy } = req.query as any;

    if (lat == null || lng == null)
      return reply.status(400).send({ error: 'lat and lng required' });

    const tolerance = gpsTolerance(accuracy);

    // Spatial check + expiry in one round-trip. Stays in `geography` end to
    // end (no ::geometry cast) for accurate spherical distance per ADR-03.
    // ST_MakePoint(longitude, latitude) — NOT lat/lng
    const drop = await queryOne<any>(`
      SELECT
        id, title, content, content_type, key_hash,
        hard_expires_at < now() AS hard_expired,
        view_expires_at < now() AS view_expired,
        ST_DWithin(
          drop_zone,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $4
        ) AS inside_zone
      FROM drops WHERE slug = $3
    `, [lat, lng, slug, tolerance]);

    if (!drop) return reply.status(404).send({ error: 'not_found' });

    if (drop.hard_expired || drop.view_expired) {
      await log(drop.id, lat, lng, false, 'expired');
      return reply.status(410).send({ error: 'expired' });
    }

    // Gate 1: location (tolerant of GPS error — see ADR-11)
    if (!drop.inside_zone) {
      await log(drop.id, lat, lng, false, 'outside_zone');
      return reply.status(403).send({ error: 'outside_zone' });
    }

    // Gate 2: key (only if drop has one)
    if (drop.key_hash) {
      const ok = key ? await verifyKey(key, drop.key_hash) : false;
      if (!ok) {
        await log(drop.id, lat, lng, false, 'wrong_key');
        return reply.status(403).send({ error: 'wrong_key' });
      }
    }

    await log(drop.id, lat, lng, true, 'granted');
    await query(
      `UPDATE drops SET view_count = view_count + 1, view_expires_at = $2 WHERE id = $1`,
      [drop.id, viewExpiry()]
    );

    return { title: drop.title, content: drop.content, content_type: drop.content_type };
  });
}

async function log(drop_id: string, lat: number, lng: number, granted: boolean, reason: string) {
  await query(
    `INSERT INTO access_attempts (drop_id, lat, lng, granted, reason) VALUES ($1,$2,$3,$4,$5)`,
    [drop_id, lat, lng, granted, reason]
  );
}
