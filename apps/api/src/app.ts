import Fastify, { type FastifyInstance } from "fastify";
import cors from '@fastify/cors';
import helmet from "@fastify/helmet";

import { createDb } from "./db/connection.js";
import { runMigrations } from "./db/migration.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { bookRoutes } from "./routes/books.js";
import { libraryRoutes } from "./routes/libraries.js";

interface BuildOptions {
  // Pass ':memory:' in tests for a clean in-memory DB each run
  db?: string;
  logger?: boolean;
}

export async function build(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: opts.logger ?? process.env.NODE_ENV !== 'test',
  })

  // ---- Plugins ----
  await fastify.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })

  await fastify.register(helmet, { contentSecurityPolicy: false });

  // ---- Database ----
  const db = createDb(opts.db);
  runMigrations(db);

  // Decorate so route plugins can access db via fastify.db
  fastify.decorate('db', db);

  // ---- Routes ----
  // All routes are namespaced under /api
  await fastify.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes);
      await api.register(bookRoutes);
      await api.register(libraryRoutes);
    },
    { prefix: '/api' }
  );

  return fastify;
}
