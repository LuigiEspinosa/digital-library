import type { Db } from '../db/connection.js';
import type { Session, User } from '@digital-library/shared';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }

  interface FastifyRequest {
    // Populated by requireAuth preHandler. Null on unauthenticated requests.
    user: User | null;
    session: Session | null;
  }
}