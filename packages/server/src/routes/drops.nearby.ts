import { FastifyInstance } from 'fastify';
import { query } from '../db/client.ts';
import { gpsTolerance } from '../lib/spatial.ts';

export async function nearbyDropsRoute(app: FastifyInstance) {
  app.get('/drops/nearby', async (req, reply) => {
    const { lat, lng, radius_m = 5000, accuracy } = req.query as any;

    if (lat == null || lng == null)
      return reply.status(400).send({ error: 'lat and lng required' });

    const tolerance = gpsTolerance(accuracy);

    const drops = await query(`
      SELECT
        id,
        CASE WHEN ST_DWithin(
          drop_zone, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4
        ) THEN slug END                  AS slug,
        title,
        key_hash IS NOT NULL             AS has_key,
        hard_expires_at,
        ST_Y(ST_Centroid(drop_zone::geometry)) AS lat,
        ST_X(ST_Centroid(drop_zone::geometry)) AS lng,
        ST_DWithin(
          drop_zone, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4
        )                                 AS you_are_inside
      FROM drops
      WHERE
        hard_expires_at > now()
        AND view_expires_at > now()
        AND ST_DWithin(
              drop_zone,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              $3
            )
    `, [lat, lng, radius_m, tolerance]);

    return { drops };
  });
}
