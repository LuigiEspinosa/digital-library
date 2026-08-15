import type { Library } from '@digital-library/shared';

/**
 * Editorial formatting for the library picker's mono metadata.
 *
 * Every string returned here is AUTHOR-CASED: MonoKicker uppercases in CSS, so
 * the DOM keeps real casing for screen readers. Never .toUpperCase() here.
 */

/** Values of 100+ are printed whole — a fixed-width slice would render "27" for 127. */
export function pad2(n: number): string {
  return n < 10 && n >= 0 ? `0${n}` : String(n);
}

export function collectionCountLabel(count = 0): string {
  return `${pad2(count)} ${count === 1 ? 'Collection' : 'Collections'}`;
}

/**
 * Book counts are deliberately NOT zero-padded, unlike readers and collections —
 * the design prompt is inconsistent on purpose (`127 BOOKS`, but `02 READERS`).
 */
export function bookCountLabel(count = 0): string {
  return `${count} ${count === 1 ? 'Book' : 'Books'}`;
}

export function readerCountLabel(count = 0): string {
  return `${pad2(count)} ${count === 1 ? 'Reader' : 'Readers'}`;
}

// Short and boring on purpose: a longer list starts making editorial judgements
// about which words carry meaning, which is not a job for a string helper.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'or', 'for', 'to', 'in', 'on', 'with'
]);

// Strips only LEADING/TRAILING punctuation, so "Sci-fi," keeps its hyphen and
// "Luigi's" keeps its apostrophe.
function stripEdgePunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Editorial kickers the prompt specifies verbatim (09-library-picker.md seed table).
 * Derivation cannot produce these — `REFERENCE · TECHNICAL` appears on a library with
 * no description at all, and the AC explicitly allows hard-coding per library for v1.
 * Keyed by exact library name; anything absent falls through to derivation, so an
 * unrecognised or renamed library degrades quietly instead of rendering nothing.
 */
const VIBE_TAG_OVERRIDES = new Map<string, string>([
  ['The Garage Shelf', 'Fiction · Philosophy · Manuals'],
  ['Comics', 'Graphic novels · Series'],
  ['Reference', 'Reference · Technical'],
  ["Luigi's Work Library", 'Client work · Decks']
]);

/**
 * The row kicker: a hard-coded editorial tag where one is specified, else the first
 * three content words of the description, else the library NAME. The prompt says
 * "derived from the description", but its own seed data gives a description-less
 * library a kicker, and DESIGN.md §7 wants every row to carry one — so derivation
 * alone cannot produce the specified output.
 */
export function vibeTag(library: Pick<Library, 'name' | 'description'>): string {
  const name = library.name.trim();
  const override = VIBE_TAG_OVERRIDES.get(name);
  if (override) return override;

  const description = library.description?.trim() ?? '';
  const source = description || name;

  const words = source
    .split(/\s+/)
    .map(stripEdgePunctuation)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3);

  // A source of pure punctuation or pure stop-words yields nothing usable, and so
  // does a whitespace-only name — both would render an empty <span>. The literal is
  // the last resort behind the trimmed name, so the return is never the empty string.
  return words.join(' · ') || name || 'Collection';
}

/**
 * SQLite's datetime('now') emits 'YYYY-MM-DD HH:MM:SS' — no `T`, no `Z`. V8
 * parses that shape as LOCAL time, silently skewing every relative label by the
 * host's UTC offset, so it is stamped as UTC before parsing. Inputs that already
 * carry a timezone designator are left alone.
 */
function parseTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  // Fractional seconds are matched too: datetime('now') does not emit them today,
  // but a switch to strftime('…%f') would otherwise fall through to V8's LOCAL-time
  // parse — silently skewing every label by the host offset, with no error.
  const isNakedSqlStamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed);
  const date = new Date(isNakedSqlStamp ? `${trimmed.replace(' ', 'T')}Z` : trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * Author-cased relative time. `now` is injectable so tests are deterministic —
 * components must never reach for Date.now() themselves.
 *
 * Returns null for a null/undefined/unparseable input; the caller omits the line
 * rather than rendering "Invalid Date".
 */
export function relative(
  iso: string | null | undefined,
  now: Date | number = new Date()
): string | null {
  if (!iso) return null;
  const then = parseTimestamp(iso);
  if (!then) return null;

  const seconds = (new Date(now).getTime() - then.getTime()) / 1000;
  // A future stamp (clock skew) reads as "just now" rather than a negative count.
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return plural(minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, 'hour');

  const days = Math.floor(hours / 24);
  if (days < 2) return 'yesterday';
  if (days < 7) return plural(days, 'day');
  // Weeks stop at 30 days rather than 35, so "5 weeks ago" is not silently
  // unreachable; months clamp at 11 so 364 days reads as months, never the
  // "12 months ago" that should have been a year.
  if (days < 30) return plural(Math.floor(days / 7), 'week');
  if (days < 365) return plural(Math.min(11, Math.floor(days / 30)), 'month');
  return plural(Math.floor(days / 365), 'year');
}
