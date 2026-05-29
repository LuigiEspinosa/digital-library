import { describe, test, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { extractCbrMetadata } from '../services/metadata/extractCbrMetadata';

describe('extractCbrMetadata', () => {
  // * Regression guard for story 00.2 - when the archive binary is missing or
  // * the file does not exist, the extractor must swallow the error and return
  // * a title-only record so importBook can still register the file. This is
  // * the same fallback the importer has always relied on; 00.2 reshuffled the
  // * spawn logic and this test makes sure the catch-all still fires.
  test('return title-only fallback for a missing file', async () => {
    const fakePath = path.join(os.tmpdir(), `dl-cbr-missing-${Date.now()}.cbr`);

    const result = await extractCbrMetadata(fakePath);

    expect(result.title).toBe(path.basename(fakePath, '.cbr'));
    expect(result.cover_data).toBeUndefined();
    expect(result.cover_ext).toBeUndefined();
  });
});
