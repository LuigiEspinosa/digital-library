import type { FastifyPluginAsync } from "fastify";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { grantAccess, revokeAccess } from "../../acl.js";
import { requireAdmin } from "../../middleware/auth.js";

interface CreateUserBody {
  email: string;
  password: string;
  is_admin?: boolean;
}

interface UserIdParams {
  userId: string;
}

interface LibraryIdParams {
  userId: string;
  libraryId: string;
}

export const adminUserRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes in this plugin require admin.
  fastify.addHook('preHandler', requireAdmin);

  const users = new UserRepository(fastify.db);

  fastify.get('/users', async (_request, reply) => {
    return reply.send({ users: users.listAll() });
  });

  fastify.post<{ Body: CreateUserBody }>(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            is_admin: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, is_admin } = request.body;

      // Check for duplicate email
      if (users.findByEmail(email)) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A user with that email already exists.',
        });
      }

      const user = await users.create({ email, password, is_admin });
      return reply.code(201).send({ user });
    }
  );

  fastify.delete<{ Params: UserIdParams }>(
    '/users/:userId',
    async (request, reply) => {
      const { userId } = request.params;

      // Prevent admins from deleting themselves
      if (userId === request.user!.id) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'You cannot delete your own account.',
        });
      }

      if (!users.findById(userId)) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Cascade delete handles sessions + user_libraries (FK ON DELETE CASCADE)
      users.delete(userId);
      return reply.code(204).send();
    }
  );

  // Grant a user access to a library.
  fastify.put<{ Params: LibraryIdParams }>(
    '/users/:userId/libraries/:libraryId',
    async (request, reply) => {
      const { userId, libraryId } = request.params;

      // Verify user exists
      if (!users.findById(userId)) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found.'
        });
      }

      // Verify library exists
      const library = fastify.db
        .prepare('SELECT id FROM libraries WHERE id = ?')
        .get(libraryId);

      if (!library) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Library not found.'
        });
      }

      grantAccess(fastify.db, userId, libraryId);
      return reply.code(204).send();
    }
  );

  // Revoke a user's access to a library.
  fastify.delete<{ Params: LibraryIdParams }>(
    '/users/:userId/libraries/:libraryId',
    async (request, reply) => {
      const { userId, libraryId } = request.params;
      revokeAccess(fastify.db, userId, libraryId);
      return reply.code(204).send();
    }
  );
};
