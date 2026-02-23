import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from 'node:path';
import { ExtractedMetadata } from "../metadata.js";

const execFileAsync = promisify(execFile);
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

async function listCbrFiles(filePath: string): Promise<string[]> {
  // unrar lb = list bare (filenames only), no headers
  const { stdout } = await execFileAsync('unrar', ['lb', filePath]);
  return stdout
    .split('\n')
    .map(l => l.trim())
    .filter(l => IMAGE_RE.test(l))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function extractCbrFile(filePath: string, entry: string): Promise<Buffer> {
  // unrar p = print to stdout; -inul = suppress all messages
  const { stdout } = await execFileAsync('unrar', ['p', '-inul', filePath, entry], {
    encoding: 'buffer',
    maxBuffer: 50 * 1024 * 1024, // 50MB max cover size
  });
  return stdout as unknown as Buffer;
}

export async function extractCbrMetadata(filePath: string): Promise<ExtractedMetadata> {
  const title = path.basename(filePath, path.extname(filePath));

  try {
    const files = await listCbrFiles(filePath);
    if (files.length === 0) return { title };

    const cover_data = await extractCbrFile(filePath, files[0]);
    const cover_ext = path.extname(files[0]).slice(1).toLowerCase() || 'jpg';

    return { title, cover_data, cover_ext };
  } catch {
    // unrar not installed or file corrupt, return title-only fallback
    return { title };
  }
}
