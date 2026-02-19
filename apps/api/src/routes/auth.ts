import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (_request, reply) => {
    reply.code(501).send({
      statusCode: 501,
      error: 'Not Implemented',
      message: 'TODO'
    });
  });

  fastify.post('/auth/logout', async (_request, reply) => {
    reply.code(501).send({
      statusCode: 501,
      error: 'Not Implemented',
      message: 'TODO'
    });
  });
};
