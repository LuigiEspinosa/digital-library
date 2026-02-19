import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateSession,
  buildCookieOptions,
  blankCookieOptions,
  COOKIE_NAME,
} from '../auth/session.js';

/**
 * Validates the session cookie on every protected request.
 * Attaches user + session to request.user / request.session.
 * Returns 401 if the cookie is missing, invalid, or expired.
 */
export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const sessionId = request.cookies[COOKIE_NAME];

  if (!sessionId) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  const { session, user } = validateSession(request.server.db, sessionId);

  if (!session) {
    // Wipe the stale cookie
    const opts = blankCookieOptions();
    reply.setCookie(opts.name, '', opts);
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Session expired or invalid',
    });
  }

  // If the session was silently extended (past half-life), refresh the cookie
  if (session.fresh) {
    const opts = buildCookieOptions(session.expiresAt);
    reply.setCookie(opts.name, session.id, opts);
  }

  request.user = user;
  request.session = session;
};

/**
 * Like requireAuth but additionally asserts is_admin === true.
 * Returns 403 for authenticated non-admin users.
 */
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  await requireAuth(request, reply);
  if (reply.sent) return; // requireAuth already replied with 401

  if (!request.user?.is_admin) {
    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Admin access required.',
    });
  }
};
