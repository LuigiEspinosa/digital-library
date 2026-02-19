import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Validates the lucia session cookie.
 * Attaches user + session to request.user / request.session.
 * Returns 401 if cookie is absent, invald, or expired.
 * 
 * NOTE: typed as plain async functions, NOT as `preHandlerHookHandler`.
 * Fastify v4's preHandlerHookHandler type expects a callback-style `done`
 * third parameter. Async hook handlers don't use `done` and Fastify
 * handles them correctly at runtime with the plain async signature.
 */
export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const lucia = request.server.lucia;
  const sessionId = lucia.readSessionCookie(request.headers.cookie ?? '');

  if (!sessionId) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (!session) {
    const blank = lucia.createBlankSessionCookie();
    reply.setCookie(blank.name, blank.value, blank.attributes);
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Session expired or invalid.',
    });
  }

  // Lucia silently extends sessions nearing expiry.
  // If it did so, issue a refreshed cookie so the browser stays in sync.
  if (session.fresh) {
    const refreshed = lucia.createSessionCookie(session.id);
    reply.setCookie(refreshed.name, refreshed.value, refreshed.attributes);
  }

  request.user = user;
  request.session = session;
};

/**
 * Runs requireAuth, then additionally asserts is_admin === true.
 * Returns 403 for authenticated non-admin users.
 */
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  // Validate session first, this populates request.user or sends a 401.
  await requireAuth(request, reply);

  // If reply was aleready sent (401), request.user will still be null.
  if (reply.sent) return;

  if (!request.user?.is_admin) {
    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Admin access required.',
    });
  }
};
