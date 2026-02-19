import type { FastifyPluginAsync } from 'fastify';
import { UserRepository } from '../db/repositories/UserRepository.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createSession,
  invalidateSession,
  buildCookieOptions,
  blankCookieOptions,
} from '../auth/session.js';

interface LoginBody {
  email: string;
  password: string;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const users = new UserRepository(fastify.db);

  fastify.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await users.verifyPassword(email, password);

      if (!user) {
        // Generic message — never reveal whether the email exists
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      const session = createSession(fastify.db, user.id);
      const cookieOpts = buildCookieOptions(session.expiresAt);

      // httpOnly + sameSite=strict
      reply.setCookie(cookieOpts.name, session.id, cookieOpts);
      return reply.code(200).send({ user });
    }
  );

  fastify.post(
    '/auth/logout',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      invalidateSession(fastify.db, request.session!.id);
      const opts = blankCookieOptions();
      reply.setCookie(opts.name, '', opts);
      return reply.code(204).send();
    }
  );

  fastify.get(
    '/auth/me',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      return reply.send({ user: request.user });
    }
  );
};
