import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from 'node:os';
import { pipeline } from "node:stream/promises";
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { hasAccess, getAllowedLibraryIds } from "../acl.js";
import { BookRepository } from "../db/repositories/BookRepository.js";
import { importBook, detectFormat } from "../services/importBook.js";

const TEMP_DIR = process.env.TEMP_PATH ?? os.tmpdir();

export const bookRoutes: FastifyPluginAsync = async (fastify) => {
  // All books across accessible libraries (pagianted)
  fastify.get('/books', { preHandler: requireAuth }, async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
    const allowedIds = getAllowedLibraryIds(fastify.db, request.user!.id, request.user!.is_admin);
    const repo = new BookRepository(fastify.db);
    const result = repo.findAll(allowedIds, { limit: Number(limit), offset: Number(offset) });
    reply.send({ data: result.books, total: result.total, limit, offset });
  });

  fastify.get('/books/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new BookRepository(fastify.db);
    const book = repo.findById(id);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Book not found. ' });
    if ((!hasAccess(fastify.db, request.user!.id, book.library_id, request.user!.is_admin))) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied.' });
    }
    reply.send({ book });
  });

  // Books within a single library
  fastify.get('/libraries/:libraryId/books', { preHandler: requireAuth }, async (request, reply) => {
    const { libraryId } = request.params as { libraryId: string };
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };

    if (!hasAccess(fastify.db, request.user!.id, libraryId, request.user!.is_admin)) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied.' });
    }

    const repo = new BookRepository(fastify.db);
    const result = repo.findByLibrary(libraryId, { limit: Number(limit), offset: Number(offset) });
    reply.send({ data: result.books, total: result.total, limit, offset });
  });

  // Multipart upload
  fastify.post('/libraries/:libraryId/books', { preHandler: requireAuth }, async (request, reply) => {
    const { libraryId } = request.params as { libraryId: string };

    if (!hasAccess(fastify.db, request.user!.id, libraryId, request.user!.is_admin)) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied.' });
    }

    const data = await request.file();
    if (!data) return reply.code(400).send({ statusCode: 500, error: 'Bad Request', message: 'No file uploaded.' });

    const format = detectFormat(data.filename);
    if (!format) {
      await data.file.resume(); // drain the stream
      return reply.code(415).send({ statusCode: 415, error: 'Unsupported Media Type', message: `${path.extname(data.filename)}` });
    }

    // Stream to temp file - Never buffer the whole file in memory
    await mkdir(TEMP_DIR, { recursive: true });
    const tmpPath = path.join(TEMP_DIR, `dl-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      await pipeline(data.file, createWriteStream(tmpPath));

      const result = await importBook(fastify.db, libraryId, tmpPath, data.filename);

      if (result.duplicate) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A book with this content already exists.',
          book: result.book,
        });
      }

      reply.code(201).send({ book: result.book });
    } catch (err) {
      // Clean up temp file on error (importBook moves it on success, so this only runs on failure)
      await unlink(tmpPath).catch(() => { });
      throw err;
    }
  });

  fastify.delete('/books/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new BookRepository(fastify.db);
    const book = repo.findById(id);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Book not found.' });
    if (!request.user!.is_admin) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Admin only.' });
    }
    repo.delete(id);
    reply.code(204).send();
  });
};
