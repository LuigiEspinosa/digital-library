import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@digital-library/shared';

const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: HealthResponse }>(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              version: { type: 'string' },
              uptime: { type: 'number' },
              book_count: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      reply.send({
        status: 'ok',
        version: '0.0.1',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        book_count: 0, // TODO: replace with real query
      });
    }
  );
};
