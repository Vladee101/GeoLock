import { FastifyInstance } from 'fastify';
import { query } from '../db/client.ts';

export async function deleteDropRoute(app: FastifyInstance) {
  app.delete('/drops/:slug', async (req, reply) => {
    const { slug } = req.params as any;
    const ownerToken = req.headers['x-owner-token'] as string;

    if (!ownerToken)
      return reply.status(401).send({ error: 'x-owner-token header required' });

    const result = await query(
      `DELETE FROM drops WHERE slug = $1 AND owner_token = $2 RETURNING id`,
      [slug, ownerToken]
    );

    if (!result.length)
      return reply.status(404).send({ error: 'not_found_or_not_owner' });

    return reply.status(204).send();
  });
}
