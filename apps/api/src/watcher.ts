import { watch } from 'chokidar';
import { mkdtemp, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Db } from './db/connection.js';
import { detectFormat, importBook } from './services/importBook.js';

const INBOX = process.env.INBOX_PATH ?? '/data/inbox';

export function startWatcher(db: Db, log: { info: (msg: string) => void; error: (msg: string) => void }) {
  const watcher = watch(INBOX, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    }
  });

  watcher.on('add', async (filePath) => {
    const filename = path.basename(filePath);
    const format = detectFormat(filename);
    if (!format) return; // ignore non-book files

    // Use the first library found - auto-import always targets library 'default'
    // Override vie INBOX_LIBRARY_ID env var
    const libraryId = process.env.INBOX_LIBRARY_ID;
    if (!libraryId) {
      log.error(`INBOX_LIBRARY_ID not set - skipping ${filename}`);
      return;
    }

    // Copy to temp before processing so we can safely delete the inbox file
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'dl-inbox-'));
    const tmpPath = path.join(tmpDir, filename);

    try {
      /**
       * Because `importBook` calls `rename()` to move the file, we want the inbox file deleted cleanly
       * after success, not renamed to the books directory (the inbox is a staging area, not storage).
       * This also lets us handle erros without leaving orphaned files in `/data/books`.
       */
      await copyFile(filePath, tmpPath);
      const result = await importBook(db, libraryId, tmpPath, filename);

      if (result.duplicate) {
        log.info(`Skipped duplicate: ${filename}`);
      } else {
        log.info(`Imported from inbox: ${filename} -> book ${result.book.id}`);
      }
      await unlink(filePath); // Remove from inbox after succesful import
    } catch (err) {
      log.error(`Failed to import ${filename}: ${err}`);
      await unlink(tmpPath).catch(() => { });
    }
  });

  return watcher;
}
