import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ExtractedMetadata } from '../metadata';

const execFileAsync = promisify(execFile);
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

let cachedBinary: 'unar' | 'unrar' | null | undefined;

async function getArchiveBinary(): Promise<'unar' | 'unrar' | null> {
  if (cachedBinary !== undefined) return cachedBinary;
  try {
    await execFileAsync('which', ['unar']);
    cachedBinary = 'unar';
    return cachedBinary;
  } catch {
    // unar not installed, fail through
  }
  try {
    await execFileAsync('which', ['unrar']);
    cachedBinary = 'unrar';
    return cachedBinary;
  } catch {
    // unrar not installed either
  }
  cachedBinary = null;
  return cachedBinary;
}

async function listCbrFiles(
  filePath: string,
  binary: 'unar' | 'unrar',
): Promise<string[]> {
  const { stdout } =
    binary === 'unar'
      ? // lsar ships with the `unar` Debian package, prints one filename per line.
        await execFileAsync('lsar', [filePath])
      : // unrar lb = list bare (filenames only), no headers
        await execFileAsync('unrar', ['lb', filePath]);

  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => IMAGE_RE.test(l))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function extractCbrFile(
  filePath: string,
  entry: string,
  binary: 'unar' | 'unrar',
): Promise<Buffer> {
  if (binary === 'unrar') {
    // unrar p = print to stdout; -inul = supress all messages
    const { stdout } = await execFileAsync(
      'unrar',
      ['p', '-inul', filePath, entry],
      {
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024, // 50MB mas cover size
      },
    );
    return stdout as unknown as Buffer;
  }
  // ! unar har no stdout-print mode - it extracts to a directory. We create a
  // ! fresh mkdtemp, extract the single entry, read it, then rm -rf the dir.
  // ! -q silences output, -D disables the auto-subdirectory unar creates when
  // ! an archive has multiple items, so the extracted file lands at
  // ! <outDir>/<entry> (preserving any archive-internal subpath).
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'cbr-cover-'));
  try {
    await execFileAsync('unar', ['-q', '-D', '-o', outDir, filePath, entry]);
    return await readFile(path.join(outDir, entry));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

export async function extractCbrMetadata(
  filePath: string,
): Promise<ExtractedMetadata> {
  const title = path.basename(filePath, path.extname(filePath));

  try {
    const binary = await getArchiveBinary();
    if (!binary) return { title };

    const files = await listCbrFiles(filePath, binary);
    if (files.length === 0) return { title };

    const cover_data = await extractCbrFile(filePath, files[0], binary);
    const cover_ext = path.extname(files[0]).slice(1).toLowerCase() || 'jpg';

    return { title, cover_data, cover_ext };
  } catch {
    // No archive tool available, archive is corrupt, or RAR5-encryption on
    // an `unar`-only host. Title-only fallback keeps the import flow active.
    return { title };
  }
}
