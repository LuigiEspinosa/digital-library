import type { FastifyPluginAsync } from "fastify";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { LibraryRepository } from "../../db/repositories/LibraryRepository.js";
import { requireAdmin } from "../../middleware/auth.js";
import { grantAccess } from "../../acl.js";

interface LibraryBody {
  name: string;
  description?: string;
}

interface LibraryParams {
  id: string;
}

const dataDir = process.env.DATA_DIR ?? '/data';

export const adminLibraryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  const libs = new LibraryRepository(fastify.db);

  // List all with user counts
  fastify.get('/libraries', async (_request, reply) => {
    const libraries = libs.listAll().map((l) => ({
      ...l,
      user_count: libs.getUserCount(l.id),
    }));
    return reply.send({ libraries })
  });

  // Get single library
  fastify.get<{ Params: LibraryParams }>('/libraries/:id', async (request, reply) => {
    const library = libs.findById(request.params.id);
    if (!library) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Library not found.' });
    }
    return reply.send({ library });
  });

  // Create + mkdir
  fastify.post<{ Body: LibraryBody }>(
    '/libraries',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, description } = request.body;
      const library = libs.create({ name, description });
      await mkdir(path.join(dataDir, 'books', library.id), { recursive: true });
      // Auto-grant the creating admin access so they retain access if ever de-promoted.
      grantAccess(fastify.db, request.user!.id, library.id);
      return reply.code(201).send({ library });
    }
  );

  // Update name/description
  fastify.patch<{ Params: LibraryParams; Body: Partial<LibraryBody> }>(
    '/libraries/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const updated = libs.update(request.params.id, request.body);
      if (!updated) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Library not found.' });
      }
      return reply.send({ library: updated });
    }
  );

  // Delete + rm dir (best-effort fs cleanup)
  fastify.delete<{ Params: LibraryParams }>('/libraries/:id', async (request, reply) => {
    const { id } = request.params;
    if (!libs.findById(id)) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Library not found.' });
    }
    libs.delete(id); // FK cascade removes books + user_libraries
    await rm(path.join(dataDir, 'books', id), { recursive: true, force: true }).catch((err) => {
      fastify.log.warn({ err }, 'Failed to remove library directory.');
    });
    return reply.code(204).send();
  });

  // Users with access to a library
  fastify.get<{ Params: LibraryParams }>('/libraries/:id/users', async (request, reply) => {
    const library = libs.findById(request.params.id);
    if (!library) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Library not found.' });
    }
    return reply.send({ users: libs.listUsersWithAccess(library.id) });
  });
};
