import type { FastifyPluginAsync } from "fastify";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { requireAuth } from "../middleware/auth.js";

interface LoginBody {
  email: string;
  password: string;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const users = new UserRepository(fastify.db);
  const lucia = fastify.lucia;

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
        // Never reveal whether the email exists
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      const session = await lucia.createSession(user.id, {});
      const cookie = lucia.createSessionCookie(session.id);

      // httpOnly + sameSite=strict set by lucia via cookie.attributes
      reply.setCookie(cookie.name, cookie.value, cookie.attributes);
      return reply.code(200).send({ user });
    }
  );

  fastify.post(
    '/auth/logout',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      await lucia.invalidateSession(request.session!.id);
      const blank = lucia.createBlankSessionCookie();
      reply.setCookie(blank.name, blank.value, blank.attributes);
      return reply.code(204).send();
    }
  );

  // Used by the SvelteKit layout server load to hydrate session state on SSR.
  fastify.get(
    '/auth/me',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      return reply.send({ user: request.user });
    }
  )
};
