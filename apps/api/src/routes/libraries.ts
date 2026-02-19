import type { FastifyPluginAsync } from "fastify";

export const libraryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/libraries', async (_request, reply) => {
    reply.send({
      data: [],
      total: 0,
      limit: 50,
      offset: 0
    });
  });
};
