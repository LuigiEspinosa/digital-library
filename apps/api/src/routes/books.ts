import type { FastifyPluginAsync } from "fastify";

export const bookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/books', async (_request, reply) => {
    reply.send({
      data: [],
      total: 0,
      limit: 50,
      offset: 0
    });
  });

  fastify.get('/books/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Book ${id} not found.`
    });
  });
};
