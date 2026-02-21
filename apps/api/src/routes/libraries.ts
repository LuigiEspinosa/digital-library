import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { LibraryRepository } from '../db/repositories/LibraryRepository.js';
import { getAllowedLibraryIds } from '../acl.js';

export const libraryRoutes: FastifyPluginAsync = async (fastify) => {
  const libs = new LibraryRepository(fastify.db);

  // List libraries the authenticated user can access
  fastify.get('/libraries', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const libraries = user.is_admin ? libs.listAll() : libs.listForUser(user.id);
    return reply.send({ data: libraries, total: libraries.length, limit: libraries.length, offset: 0 });
  });

  // Get single library (with ACL check)
  fastify.get<{ Params: { id: string } }>(
    '/libraries/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;
      const library = libs.findById(id);

      if (!library) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Library not found.' });
      }

      const allowedIds = getAllowedLibraryIds(fastify.db, user.id, user.is_admin);
      if (!allowedIds.includes(id)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'You do not have access to this library.' });
      }

      return reply.send({ library });
    }
  );
};
