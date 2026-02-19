import type { Session, User } from 'lucia';
import type { Db } from '../db/connection.js';
import type {LuciaInstance} from '../auth/lucia.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    lucia: LuciaInstance;
  }

  interface FastifyRequest {
    user: User | null;
    session: Session | null
  }
}