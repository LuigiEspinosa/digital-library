import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@digital-library/shared';

const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: HealthResponse }>(
    '/health',
    async (_request, reply) => {
      const { count } = fastify.db
        .prepare('SELECT COUNT(*) as count FROM books')
        .get() as { count: number };

      reply.send({
        status: 'ok',
        version: '0.0.1',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        book_count: count,
      });
    }
  );
};
