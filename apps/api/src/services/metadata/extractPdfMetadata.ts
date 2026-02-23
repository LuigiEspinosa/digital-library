import { readFile } from "node:fs/promises";
import path from "node:path";
import { ExtractedMetadata } from "../services/metadata";

export async function extractPdfMetadata(filePath: string): Promise<ExtractedMetadata> {
  const basename = path.basename(filePath, '.pdf');

  /**
   * pdf.mjs is the Node-compatible entry point. The non-legacy build requires DOM environment.
   * `useWorkerFetch: false` and `isEvalSupported: false` prevent pdfjs from
   * typing to spawn a worker thread or use `eval` in Node, which both error out silently.
   */
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null);
  if (!pdfjs) return { title: basename };

  pdfjs.GlobalWorkerOptions.workerSrc = '';

  const fileBuffer = await readFile(filePath);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const info = await doc.getMetadata();
  const meta = (info.info ?? {}) as Record<string, unknown>;

  const title = ((meta.Title as string) ?? '').trim() || basename;
  const author = ((meta.Author as string) ?? '').trim() || undefined;
  const page_count = doc.numPages;

  // Cover: reder page 1 to canvas, export as PNG buffer
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
