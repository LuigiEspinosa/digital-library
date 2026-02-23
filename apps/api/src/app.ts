import Fastify, { type FastifyInstance } from "fastify";
import cors from '@fastify/cors';
import helmet from "@fastify/helmet";
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';

import { createDb } from "./db/connection.js";
import { runMigrations } from "./db/migration.js";
import { UserRepository } from "./db/repositories/UserRepository.js";

import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { bookRoutes } from "./routes/books.js";
import { libraryRoutes } from "./routes/libraries.js";
import { adminUserRoutes } from "./routes/admin/users.js";
import { adminLibraryRoutes } from "./routes/admin/libraries.js";

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
    credentials: true, // required for cookies to be sent cross-origin
  })

  await fastify.register(helmet, { contentSecurityPolicy: false });

  // @fastify/cookie is required so reply.setCookie() works.
  await fastify.register(cookie);

  await fastify.register(multipart, {
    limits: {
      fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 500 * 1024 * 1024), // 500 MB default
      files: 1,
    }
  });

  await fastify.register(staticPlugin, {
    root: process.env.COVERS_PATH ?? '/data/covers',
    prefix: '/files/covers',
    decorateReply: false,
  });

  // ---- Database ----
  const db = createDb(opts.db);
  runMigrations(db);
  fastify.decorate('db', db);

  // Decorate every request with null defatuls so TypeScript is satisfied
  // even on routes that don't run requireAuth.
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('session', null);

  // ---- First-run admin seed ----
  // If no users exist and ADMIN_EMAIL + ADMIN_PASSWORD are set,
  // create the first admin automatically.
  // This makes docker compose up -d fully self-sufficient
  const users = new UserRepository(db);
  if (users.isEmpty()) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      await users.create({
        email: adminEmail,
        password: adminPassword,
        is_admin: true
      });

      fastify.log.info(`First admin created: ${adminEmail}`);
    }
  }


  // ---- Routes ----
  // All routes are namespaced under /api
  await fastify.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes);
      await api.register(bookRoutes);
      await api.register(libraryRoutes);
      await api.register(adminUserRoutes, { prefix: '/admin' });
      await api.register(adminLibraryRoutes, { prefix: '/admin' });
    },
    { prefix: '/api' }
  );

  return fastify;
}
