import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.ts';

export async function attemptsRoute(app: FastifyInstance) {
  app.get('/drops/:slug/attempts', async (req, reply) => {
    const { slug } = req.params as any;
    const ownerToken = req.headers['x-owner-token'] as string;

    if (!ownerToken)
      return reply.status(401).send({ error: 'x-owner-token header required' });

    const drop = await queryOne<any>(
      `SELECT id FROM drops WHERE slug = $1 AND owner_token = $2`,
      [slug, ownerToken]
    );

    if (!drop) return reply.status(404).send({ error: 'not_found_or_not_owner' });

    const attempts = await query(`
      SELECT lat, lng, granted, reason, attempted_at
      FROM access_attempts
      WHERE drop_id = $1
      ORDER BY attempted_at DESC
      LIMIT 500
    `, [drop.id]);

    return {
      total:   attempts.length,
      granted: attempts.filter(a => a.granted).length,
      denied:  attempts.filter(a => !a.granted).length,
      attempts,
    };
  });
}
