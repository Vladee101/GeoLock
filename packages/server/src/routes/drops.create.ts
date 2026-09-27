import { FastifyInstance } from 'fastify';
import { query } from '../db/client.ts';
import { generateSlug } from '../lib/slug.ts';
import { hashKey } from '../lib/key.ts';
import { hardExpiry, viewExpiry } from '../lib/expiry.ts';
import { randomUUID } from 'crypto';

// Floor matches ADR-12: must stay >= MAX_GPS_TOLERANCE_M (lib/spatial.ts) so
// the zone is never smaller than the GPS tolerance applied against it.
const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 20000;
const MAX_CONTENT_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 200;
const MAX_KEY_LENGTH = 200;
const MAX_EXPIRY_HOURS = 24 * 7; // ADR-06: creator-configurable up to 7 days

export async function createDropRoute(app: FastifyInstance) {
  app.post('/drops', async (req, reply) => {
    const { title, content, lat, lng, radius_m = 100, key, hard_expires_at } = req.body as any;

    if (!content || lat == null || lng == null)
      return reply.status(400).send({ error: 'content, lat, lng required' });

    if (content.length > MAX_CONTENT_LENGTH)
      return reply.status(400).send({ error: `content must be under ${MAX_CONTENT_LENGTH} characters` });

    if (title && title.length > MAX_TITLE_LENGTH)
      return reply.status(400).send({ error: `title must be under ${MAX_TITLE_LENGTH} characters` });

    if (key && key.length > MAX_KEY_LENGTH)
      return reply.status(400).send({ error: `key must be under ${MAX_KEY_LENGTH} characters` });

    // Coerce once: numeric strings ("52.2") pass range checks via JS
    // comparison coercion, but NaN ("abc", objects) slips through < / >
    // (all NaN comparisons are false) and would reach PostGIS as a 500
    // instead of this clean 400. Number.isFinite closes that gap.
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) ||
        latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180)
      return reply.status(400).send({ error: 'lat/lng out of range' });

    if (radius_m < MIN_RADIUS_M || radius_m > MAX_RADIUS_M)
      return reply.status(400).send({ error: `radius_m must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}` });

    const expires   = hard_expires_at ? new Date(hard_expires_at) : hardExpiry(24);
    const maxExpiry = new Date(Date.now() + MAX_EXPIRY_HOURS * 3_600_000);

    if (isNaN(expires.getTime()) || expires <= new Date() || expires > maxExpiry)
      return reply.status(400).send({ error: `hard_expires_at must be in the future and within ${MAX_EXPIRY_HOURS / 24} days` });

    const slug        = generateSlug();
    const owner_token = randomUUID();
    const key_hash    = key ? await hashKey(key) : null;

    // CRITICAL: ST_MakePoint(longitude, latitude) — NOT lat/lng order
    await query(`
      INSERT INTO drops
        (slug, title, content, drop_zone, radius_m, key_hash, owner_token, hard_expires_at, view_expires_at)
      VALUES (
        $1, $2, $3,
        ST_Buffer(ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6),
        $6, $7, $8, $9, $10
      )
    `, [slug, title ?? null, content, latNum, lngNum, radius_m, key_hash, owner_token, expires, viewExpiry()]);

    return reply.status(201).send({ slug, owner_token, expires_at: expires });
  });
}
