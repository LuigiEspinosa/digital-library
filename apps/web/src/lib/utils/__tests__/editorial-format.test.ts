import { describe, test, expect } from 'vitest';
import {
  pad2,
  collectionCountLabel,
  bookCountLabel,
  readerCountLabel,
  vibeTag,
  relative,
  progressLabel,
  formatLabel,
  publicationYear
} from '../editorial-format';
import type { BookFormat } from '@digital-library/shared';

describe('pad2', () => {
  test('pads a single digit to two', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(4)).toBe('04');
    expect(pad2(9)).toBe('09');
  });

  test('leaves two digits alone', () => {
    expect(pad2(10)).toBe('10');
    expect(pad2(99)).toBe('99');
  });

  // The prompt prints 127 whole; a fixed-width slice would render "27".
  test('does not truncate three digits or more', () => {
    expect(pad2(127)).toBe('127');
    expect(pad2(1000)).toBe('1000');
  });
});

describe('count labels', () => {
  // Books are NOT padded; readers and collections ARE. This asymmetry is the
  // single easiest silent AC failure on this screen.
  test('book counts are unpadded and pluralize', () => {
    expect(bookCountLabel(0)).toBe('0 Books');
    expect(bookCountLabel(1)).toBe('1 Book');
    expect(bookCountLabel(2)).toBe('2 Books');
    expect(bookCountLabel(127)).toBe('127 Books');
  });

  test('reader counts are zero-padded and pluralize', () => {
    expect(readerCountLabel(0)).toBe('00 Readers');
    expect(readerCountLabel(1)).toBe('01 Reader');
    expect(readerCountLabel(2)).toBe('02 Readers');
  });

  // The page kicker used to hardcode "Collections", so a one-library account read
  // "Issue · 01 Collections" while the two labels beside it pluralized correctly.
  test('collection counts are zero-padded and pluralize', () => {
    expect(collectionCountLabel(0)).toBe('00 Collections');
    expect(collectionCountLabel(1)).toBe('01 Collection');
    expect(collectionCountLabel(4)).toBe('04 Collections');
  });

  // book_count/user_count are optional on the shared Library type, so a payload
  // missing them must still render a real string, not "undefined Books".
  test('a missing count reads as zero', () => {
    expect(bookCountLabel()).toBe('0 Books');
    expect(readerCountLabel()).toBe('00 Readers');
  });

  test('labels are author-cased, never pre-shouted', () => {
    expect(bookCountLabel(3)).not.toBe('3 BOOKS');
    expect(readerCountLabel(3)).not.toBe('03 READERS');
  });
});

describe('vibeTag', () => {
  // Every fixture below deliberately avoids the four overridden names — those are
  // covered in their own describe, and reusing them here would test the map, not
  // the derivation.
  test('takes the first three content words of the description', () => {
    expect(
      vibeTag({ name: 'Fiction', description: 'Sci-fi, philosophy, and the occasional manual.' })
    ).toBe('Sci-fi · philosophy · occasional');
  });

  test('drops stop-words before counting to three', () => {
    expect(vibeTag({ name: 'Strips', description: 'Graphic novels and serialized issues.' })).toBe(
      'Graphic · novels · serialized'
    );
  });

  test('falls back to the name when there is no description', () => {
    expect(vibeTag({ name: 'Almanac' })).toBe('Almanac');
    expect(vibeTag({ name: 'Almanac', description: '' })).toBe('Almanac');
    expect(vibeTag({ name: 'Almanac', description: '   ' })).toBe('Almanac');
  });

  test('derives from a multi-word name the same way', () => {
    expect(vibeTag({ name: "Luigi's Spare Shelf" })).toBe("Luigi's · Spare · Shelf");
  });

  // Edge punctuation only: internal hyphens and apostrophes are part of the word.
  test('strips edge punctuation but keeps hyphens and apostrophes', () => {
    expect(vibeTag({ name: 'X', description: '"Quoted", hyphen-word, done.' })).toBe(
      'Quoted · hyphen-word · done'
    );
  });

  test('never returns an empty string', () => {
    expect(vibeTag({ name: 'Almanac', description: '...' })).toBe('Almanac');
    expect(vibeTag({ name: 'Almanac', description: 'the and of' })).toBe('Almanac');
  });

  // A whitespace-only name leaves nothing to derive from and nothing to fall back
  // to, which is the one input that used to return '' and render a hollow kicker.
  test('a whitespace-only name still yields a kicker', () => {
    expect(vibeTag({ name: '   ' })).toBe('Collection');
    expect(vibeTag({ name: '   ', description: '  ...  ' })).toBe('Collection');
  });
});

describe('vibeTag overrides', () => {
  // The prompt's seed table specifies these verbatim; derivation reproduces none
  // of them, and 'Reference · Technical' belongs to a library with no description
  // at all, so it cannot be derived even in principle.
  test('uses the editorial tag the prompt specifies, per library name', () => {
    expect(vibeTag({ name: 'The Garage Shelf' })).toBe('Fiction · Philosophy · Manuals');
    expect(vibeTag({ name: 'Comics' })).toBe('Graphic novels · Series');
    expect(vibeTag({ name: 'Reference' })).toBe('Reference · Technical');
    expect(vibeTag({ name: "Luigi's Work Library" })).toBe('Client work · Decks');
  });

  test('the override beats a description that would derive something else', () => {
    expect(vibeTag({ name: 'Comics', description: 'Graphic novels and serialized issues.' })).toBe(
      'Graphic novels · Series'
    );
  });

  // The override stops the kicker echoing the name directly above it — the whole
  // reason 'Reference' is in the map.
  test('an overridden row does not repeat its own name', () => {
    expect(vibeTag({ name: 'Reference' })).not.toBe('Reference');
  });

  test('an unrecognised name falls through to derivation rather than rendering nothing', () => {
    expect(vibeTag({ name: 'The Garage Shelf Annex' })).toBe('Garage · Shelf · Annex');
    expect(vibeTag({ name: 'Some Other Library' })).toBe('Some · Other · Library');
  });

  test('overrides are author-cased, never pre-shouted', () => {
    expect(vibeTag({ name: 'Comics' })).not.toBe('GRAPHIC NOVELS · SERIES');
  });
});

describe('relative', () => {
  const now = new Date('2026-08-14T12:00:00Z');
  const agoBy = (ms: number) => new Date(now.getTime() - ms).toISOString();

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // The single highest-risk line in the module: 'YYYY-MM-DD HH:MM:SS' has no T
  // and no Z, and V8 reads it as LOCAL time. Without normalization this test
  // fails by exactly the host's UTC offset — so it would pass in London and fail
  // in Bogota, which is precisely the bug being pinned.
  test('reads a naked SQLite stamp as UTC, not local time', () => {
    expect(relative('2026-08-14 10:00:00', now)).toBe('2 hours ago');
    // Same instant, explicitly zoned: both spellings must agree.
    expect(relative('2026-08-14T10:00:00Z', now)).toBe('2 hours ago');
  });

  test('an offset-bearing input is not re-stamped as UTC', () => {
    expect(relative('2026-08-14T11:00:00+00:00', now)).toBe('1 hour ago');
  });

  // datetime('now') emits no fractional part today, but a strftime('…%f') switch
  // would otherwise fall through to V8's local-time parse and skew silently.
  // Deliberately off the bucket boundary: at exactly 10:00:00.123 the fraction puts
  // the gap 0.123s under two hours, which floors to "1 hour ago" and would look like
  // a timezone bug rather than the rounding it is.
  test('a naked stamp carrying fractional seconds is still read as UTC', () => {
    expect(relative('2026-08-14 09:30:00.500', now)).toBe('2 hours ago');
    // Under a local-time parse this stamp lands in the future and reads "just now".
    expect(relative('2026-08-14 09:30:00.500', now)).not.toBe('just now');
  });

  test('under a minute reads as just now', () => {
    expect(relative(agoBy(0), now)).toBe('just now');
    expect(relative(agoBy(59 * SECOND), now)).toBe('just now');
  });

  test('a future stamp does not render a negative count', () => {
    expect(relative('2026-08-14T18:00:00Z', now)).toBe('just now');
  });

  test('minutes bucket, singular at one', () => {
    expect(relative(agoBy(MINUTE), now)).toBe('1 minute ago');
    expect(relative(agoBy(2 * MINUTE), now)).toBe('2 minutes ago');
    expect(relative(agoBy(59 * MINUTE), now)).toBe('59 minutes ago');
  });

  test('hours bucket, singular at one', () => {
    expect(relative(agoBy(HOUR), now)).toBe('1 hour ago');
    expect(relative(agoBy(23 * HOUR), now)).toBe('23 hours ago');
  });

  // 24-48h is "yesterday", so "1 day ago" is never rendered.
  test('the 24-48h window reads as yesterday', () => {
    expect(relative(agoBy(DAY), now)).toBe('yesterday');
    expect(relative(agoBy(47 * HOUR), now)).toBe('yesterday');
  });

  test('days bucket starts at two and stops before a week', () => {
    expect(relative(agoBy(2 * DAY), now)).toBe('2 days ago');
    expect(relative(agoBy(6 * DAY), now)).toBe('6 days ago');
  });

  test('weeks bucket, singular at one', () => {
    expect(relative(agoBy(7 * DAY), now)).toBe('1 week ago');
    expect(relative(agoBy(29 * DAY), now)).toBe('4 weeks ago');
  });

  test('months bucket, singular at one', () => {
    expect(relative(agoBy(30 * DAY), now)).toBe('1 month ago');
    expect(relative(agoBy(60 * DAY), now)).toBe('2 months ago');
  });

  // The two boundaries a naive ramp gets wrong: weeks that run to 35 days make
  // "5 weeks ago" unreachable, and an unclamped month bucket renders 364 days as
  // "12 months ago" — a year, spelled as months.
  test('never renders twelve months or a fifth week', () => {
    expect(relative(agoBy(364 * DAY), now)).toBe('11 months ago');
    for (let d = 7; d < 365; d++) {
      const label = relative(agoBy(d * DAY), now);
      expect(label).not.toBe('5 weeks ago');
      expect(label).not.toBe('12 months ago');
    }
  });

  test('years bucket, singular at one', () => {
    expect(relative(agoBy(365 * DAY), now)).toBe('1 year ago');
    expect(relative(agoBy(730 * DAY), now)).toBe('2 years ago');
  });

  test('null, undefined and unparseable input all return null', () => {
    expect(relative(null, now)).toBeNull();
    expect(relative(undefined, now)).toBeNull();
    expect(relative('', now)).toBeNull();
    expect(relative('not a date', now)).toBeNull();
  });

  test('is author-cased', () => {
    expect(relative(agoBy(2 * HOUR), now)).toBe('2 hours ago');
  });
});

describe('progressLabel', () => {
  const book = (
    format: BookFormat,
    progress_position: string | null,
    page_count?: number
  ) => ({ format, progress_position, page_count });

  test('no stored position reads as unread', () => {
    expect(progressLabel(book('pdf', null, 288))).toBe('Unread');
    expect(progressLabel(book('pdf', '', 288))).toBe('Unread');
    expect(progressLabel(book('pdf', '   ', 288))).toBe('Unread');
  });

  // An EPUB position is an opaque CFI: it carries no fraction of the whole, so a
  // percentage cannot be derived from it at all — never a number beside "Reading".
  test('an EPUB CFI reads as a bare Reading, with no percentage', () => {
    const label = progressLabel(book('epub', 'epubcfi(/6/14!/4/2/2/1:0)'));
    expect(label).toBe('Reading');
    expect(label).not.toContain('%');
  });

  test('a PDF part-way through reads as a percentage', () => {
    expect(progressLabel(book('pdf', '121', 288))).toBe('Reading · 42%');
  });

  test('a PDF on its last page is finished, and past it clamps', () => {
    expect(progressLabel(book('pdf', '288', 288))).toBe('Finished');
    expect(progressLabel(book('pdf', '999', 288))).toBe('Finished');
  });

  // Both clamps contradict the word beside them if left alone: page 1 of 288
  // rounds to 0% ("Reading · 0%") and page 287 rounds to 100% while unfinished.
  test('the first page never reads 0% and the last-but-one never reads 100%', () => {
    expect(progressLabel(book('pdf', '1', 288))).toBe('Reading · 1%');
    expect(progressLabel(book('pdf', '287', 288))).toBe('Reading · 99%');
  });

  test('a page-based format with no usable page_count degrades to Reading', () => {
    expect(progressLabel(book('pdf', '121', undefined))).toBe('Reading');
    expect(progressLabel(book('pdf', '121', 0))).toBe('Reading');
  });

  // The Epic 04 D.1 state: comics store a page number but carry no page_count
  // yet, so they read bare today and upgrade to a percentage for free later.
  test('a comic with a position but no page count reads as Reading', () => {
    expect(progressLabel(book('cbz', '12'))).toBe('Reading');
    expect(progressLabel(book('cbr', '12'))).toBe('Reading');
  });

  test('a comic that HAS a page count reads as a percentage', () => {
    expect(progressLabel(book('cbz', '12', 24))).toBe('Reading · 50%');
  });

  // Strict parse: parseInt would read '4/12' as page 4 and print a confident,
  // wrong percentage. That is why pdfUtils' parseStoredPage is not reused here.
  test('an unparseable position degrades rather than guessing a page', () => {
    expect(progressLabel(book('pdf', 'abc', 288))).toBe('Reading');
    expect(progressLabel(book('pdf', '4/12', 288))).toBe('Reading');
    expect(progressLabel(book('pdf', '12.5', 288))).toBe('Reading');
  });

  // Pages are 1-based, so '0' is degenerate input, not page zero — and the pct <= 0
  // clamp that rescues page 1 of 288 would otherwise dress it up as `Reading · 1%`.
  test('a zero position degrades rather than reading as one percent', () => {
    expect(progressLabel(book('pdf', '0', 288))).toBe('Reading');
    expect(progressLabel(book('pdf', '000', 288))).toBe('Reading');
  });

  // Compares each label against its OWN uppercased form, so it pins the CONVENTION
  // rather than restating values the exact assertions above already fix — the shape
  // that stays meaningful when the copy changes.
  test('is author-cased, never pre-shouted', () => {
    const labels = [
      progressLabel(book('pdf', '121', 288)),
      progressLabel(book('pdf', null)),
      progressLabel(book('epub', 'epubcfi(/6/4!/4/2)')),
      progressLabel(book('pdf', '288', 288))
    ];

    for (const label of labels) {
      expect(label).not.toBe(label.toUpperCase());
    }
  });
});

describe('formatLabel', () => {
  // EPUB/PDF/CBZ/CBR are initialisms — caps IS their real casing, so they are not
  // a break with the author-cased convention. 'Images' is a word and stays so.
  test('names every format', () => {
    expect(formatLabel('epub')).toBe('EPUB');
    expect(formatLabel('pdf')).toBe('PDF');
    expect(formatLabel('cbz')).toBe('CBZ');
    expect(formatLabel('cbr')).toBe('CBR');
    expect(formatLabel('images')).toBe('Images');
  });
});

describe('publicationYear', () => {
  test('takes the leading four-digit year', () => {
    expect(publicationYear('2019-05-07')).toBe('2019');
    expect(publicationYear('2019')).toBe('2019');
  });

  // The caller omits the ` · YEAR` half on null rather than printing a placeholder.
  test('anything without a leading year is null', () => {
    expect(publicationYear(undefined)).toBeNull();
    expect(publicationYear('')).toBeNull();
    expect(publicationYear('n.d.')).toBeNull();
    expect(publicationYear('May 2019')).toBeNull();
  });

  // Several metadata sources use 0000 as a null-date sentinel, and `EPUB · 0000`
  // reads as a real year rather than as missing data.
  test('the 0000 null-date sentinel is not a year', () => {
    expect(publicationYear('0000')).toBeNull();
    expect(publicationYear('0000-01-01')).toBeNull();
  });
});

