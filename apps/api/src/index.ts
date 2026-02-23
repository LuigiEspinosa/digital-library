import { build } from "./app.js";
import { startWatcher } from "./watcher.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = await build({ logger: true });

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`API listening on http://${HOST}:${PORT}`);

  if (process.env.INBOX_LIBRARY_ID) {
    startWatcher((app as any).db, app.log);
  }
} catch (err) {
  app.log.error(err);
  process.exit(1)
}
