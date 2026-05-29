import { describe, test, expect } from 'vitest';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { extractPdfMetadata } from '../services/metadata/extractPdfMetadata';

// * Hand-rolled minimal-valid PDF generator. Writes a 1-page PDF whose page
// * content stream is 4 bytes ("q Q\n" - push and pop an empty graphics state),
// * plus a separate stream object (#6) stuffed with `padMb` MB of ASCII spaces.
// * Object 6 is present in the xref table but referenced by nothing, so pdfjs
// * nover fetches it during metadata or page-1 render. The file is `padMb` MB
// * on disk; pdfjs reads ~64kb worth of ranged requests agains it. That is
// * the exact streaming guarantee under test - the old readFile() path would
// * have loaded the full `padMb` MB into RSS before pdfjs even started parsing.
// ! If you change object 6 to be referenced by /Contents or /Resources, pdfjs
// ! WILL stream the padding through its content parser and this test will
// ! fail for the wrong reason - you will be measuring pdfjs' own buffering,
// ! not the readFile fix.
async function writeLargePdf(outPath: string, padMb: number): Promise<void> {
  const padBytes = padMb * 1024 * 1024;
  const fillChunk = Buffer.alloc(1024 * 1024, 0x20); // 1MB of space characters

  const header = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const obj1 =
    '1 0 obj\n<< /Title (Test PDF) /Author (Test Author) >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n';
  const obj4 =
    '4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n';
  const obj5 = '5 0 obj\n<< /Length 4 >>\nstream\nq Q\nendstream\nendobj\n';
  const obj6Header = `6 0 obj\n<< /Length ${padBytes} >>\nstream\n`;
  const obj6Footer = '\nendstream\nendobj\n';

  const bl = (s: string) => Buffer.byteLength(s, 'binary');
  const off1 = bl(header);
  const off2 = off1 + bl(obj1);
  const off3 = off2 + bl(obj2);
  const off4 = off3 + bl(obj3);
  const off5 = off4 + bl(obj4);
  const off6 = off5 + bl(obj5);
  const xrefOffset = off6 + bl(obj6Header) + padBytes + bl(obj6Footer);

  const pad10 = (n: number) => n.toString().padStart(10, '0');
  const xref =
    'xref\n0 7\n' +
    '0000000000 65535 f \n' +
    `${pad10(off1)} 00000 n \n` +
    `${pad10(off2)} 00000 n \n` +
    `${pad10(off3)} 00000 n \n` +
    `${pad10(off4)} 00000 n \n` +
    `${pad10(off5)} 00000 n \n` +
    `${pad10(off6)} 00000 n \n`;
  const trailer = `trailer\n<< /Size 7 /Root 2 0 R /Info 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(outPath);
    ws.on('error', reject);
    ws.on('finish', () => resolve());

    ws.write(header, 'binary');
    ws.write(obj1);
    ws.write(obj2);
    ws.write(obj3);
    ws.write(obj4);
    ws.write(obj5);
    ws.write(obj6Header);

    let remaining = padBytes;
    const pump = (): void => {
      let ok = true;
      while (remaining > 0 && ok) {
        const size = Math.min(fillChunk.length, remaining);
        const chunk =
          size === fillChunk.length ? fillChunk : fillChunk.subarray(0, size);
        ok = ws.write(chunk);
        remaining -= size;
      }
      if (remaining > 0) ws.once('drain', pump);
      else {
        ws.write(obj6Footer);
        ws.write(xref);
        ws.write(trailer);
        ws.end();
      }
    };
    pump();
  });
}

describe('extractPdfMetadata', () => {
  test('streams large PDFs without buffering the full file (100MB fixture)', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'dl-pdf-'));
    const fixture = path.join(tmp, 'large.pdf');
    try {
      await writeLargePdf(fixture, 100);

      // Warm V8 and the pdfjs module so the RSS baseline does not capture
      // first-import allocations (pdfjs is ~6MB of JS).
      const tinyFixture = path.join(tmp, 'tiny.pdf');
      await writeLargePdf(tinyFixture, 0);
      await extractPdfMetadata(tinyFixture);

      if (global.gc) global.gc();
      const rssBefore = process.memoryUsage().rss;
      const meta = await extractPdfMetadata(fixture);
      if (global.gc) global.gc();
      const rssAfter = process.memoryUsage().rss;

      expect(meta.title).toBe('Test PDF');
      expect(meta.author).toBe('Test Author');
      expect(meta.page_count).toBe(1);

      const growthMb = (rssAfter - rssBefore) / (1024 * 1024);
      // 50MB is the story's stated ceiling. Streaming reads are ~64kb, so
      // real growth should be well under 5MB; the headroom absorbs pdfjs
      // object-cache churn and canvas allocation noise.
      expect(growthMb).toBeLessThan(50);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
