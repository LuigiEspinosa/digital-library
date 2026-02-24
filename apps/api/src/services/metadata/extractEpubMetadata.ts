import path from "node:path";
import unzipper from "unzipper";
import { ExtractedMetadata } from "../metadata.js";

function extractXmlText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]+)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

export async function extractEpubMetadata(filePath: string): Promise<ExtractedMetadata> {
  const basename = path.basename(filePath, '.epub');
  const dir = await unzipper.Open.file(filePath);

  const containerFile = dir.files.find(f => f.path === 'META-INF/container.xml');
  if (!containerFile) return { title: basename };

  const containerXml = (await containerFile.buffer()).toString('utf-8');
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) return { title: basename };

  const opfPath = opfPathMatch[1];
  const opfFile = dir.files.find(f => f.path === opfPath);
  if (!opfFile) return { title: basename };

  const opfXml = (await opfFile.buffer()).toString('utf-8');
  const opfDir = path.posix.dirname(opfPath);

  const title = extractXmlText(opfXml, 'dc:title') ?? basename;
  const author = extractXmlText(opfXml, 'dc:creator') ?? undefined;
  const description = extractXmlText(opfXml, 'dc:description') ?? undefined;
  const published_at = extractXmlText(opfXml, 'dc:date') ?? undefined;
  const language = extractXmlText(opfXml, 'dc:language') ?? undefined;

  // ISBN: dc:identifier with scheme="ISBN"
  const isbnMath = opfXml.match(
    /<dc:identifier[^>]*(?:scheme=["']ISBN["']|ISBN)[^>]*>([^<]+)<\/dc:identifier>/i
  );
  const isbn = isbnMath?.[1]?.trim();

  // Cover image: find via <meta name="cover">
  let cover_data: Buffer | undefined;
  let cover_ext: string | undefined;

  const coverIdMatch =
    opfXml.match(/<meta\s+name=["']cover["']\s+content=["']([^"']+)["']/i) ??
    opfXml.match(/<meta\s+content=["']([^"']+)["']\s+name=["']cover["']/i);

  if (coverIdMatch) {
    const coverId = coverIdMatch[1].trim();
    const itemMatch =
      opfXml.match(new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["']`, 'i')) ??
      opfXml.match(new RegExp(`<item[^>]+href=["']([^"']+)["'][^>]+id=["']${coverId}["']`, 'i'));

    if (itemMatch) {
      const relHref = itemMatch[1];
      const fullPath = opfDir === '.' ? relHref : `${opfDir}/${relHref}`;
      const coverFile =
        dir.files.find(f => f.path === fullPath) ??
        dir.files.find(f => f.path.endsWith('/' + relHref));

      if (coverFile) {
        cover_data = await coverFile.buffer();
        cover_ext = path.extname(relHref).slice(1).toLowerCase() || 'jpg';
      }
    }
  }

  // Fallback: any image with "cover" in the filename
  if (!cover_data) {
    const fallbackCover = dir.files.find(
      f => /\.(jpe?g|png|webp)$/i.test(f.path) && /cover/i.test(f.path)
    );
    if (fallbackCover) {
      cover_data = await fallbackCover.buffer();
      cover_ext = path.extname(fallbackCover.path).slice(1).toLowerCase() || 'jpg';
    }
  }

  return { title, author, description, isbn, published_at, language, cover_data, cover_ext };
}
