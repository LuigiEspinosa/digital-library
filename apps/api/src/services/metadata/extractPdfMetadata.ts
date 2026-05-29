import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { ExtractedMetadata } from '../metadata.js';

const require = createRequire(import.meta.url);

export async function extractPdfMetadata(
  filePath: string,
): Promise<ExtractedMetadata> {
  const basename = path.basename(filePath, '.pdf');

  /**
   * pdf.mjs is the Node-compatible entry point. The non-legacy build requires DOM environment.
   * `useWorkerFetch: false` and `isEvalSupported: false` prevent pdfjs from
   * typing to spawn a worker thread or use `eval` in Node, which both error out silently.
   */
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(
    () => null,
  );
  if (!pdfjs) return { title: basename };

  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href;

  // * Streaming via file:// URL. pdfjs on Node uses PDFNodeStream to satisfy a
  // * file URL with ranged fs.createReadStream reads (default chunk 64KB), so
  // * RSS stays flat regardless of file size. Replaces the previous
  // * `await readFile(filePath)` + `new Unit8Array(fileBuffer)` pattern which
  // * buffered the whole file.
  // ! `useWorkerFetch: false` and `isEvalSupported: false` are NOT vestigial
  // ! they block pdfjs from spawning a worker or eval-ing JS embedded in the
  // ! PDF on Node. Removing them silently error out or opens an RCE surface.
  const doc = await pdfjs.getDocument({
    url: pathToFileURL(filePath).href,
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const info = await doc.getMetadata();
  const meta = (info.info ?? {}) as Record<string, unknown>;

  const title = ((meta.Title as string) ?? '').trim() || basename;
  const author = ((meta.Author as string) ?? '').trim() || undefined;
  const page_count = doc.numPages;

  // Cover: render page 1 to canvas, export as PNG buffer
  let cover_data: Buffer | undefined;
  const cover_ext = 'jpg';

  try {
    const { createCanvas } = await import('canvas');
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    cover_data = canvas.toBuffer('image/png');
  } catch {
    // canvas not available or render failed - proceed witout cover
  }

  await doc.destroy();

  return { title, author, page_count, cover_data, cover_ext };
}
