import { describe, test, expect } from 'vitest';
import { get } from 'svelte/store';
import { readingPosition } from '../readingPosition';

describe('readingPosition store', () => {
  test('starts with null state', () => {
    const s = get(readingPosition);
    expect(s.bookId).toBeNull();
    expect(s.position).toBeNull();
  });

  test('setPosition() stores bookId and CFI', () => {
    const cfi = 'epubcfi(/6/4[chap01]!/4/2/2/1:0)';
    readingPosition.setPosition('book-123', cfi);
    const s = get(readingPosition);
    expect(s.bookId).toBe('book-123');
    expect(s.position).toBe(cfi);
  });

  test('setPosition() overwrites a previous position', () => {
    readingPosition.setPosition('book-123', 'epubcfi(/6/4!/1:0)');
    readingPosition.setPosition('book-123', 'epubcfi(/6/6!/1:0)');
    expect(get(readingPosition).position).toBe('epubcfi(/6/6!/1:0)');
  });

  test('reset() clears bookId and position', () => {
    readingPosition.setPosition('book-123', 'epubcfi(/6/4!/1:0)');
    readingPosition.reset();
    const s = get(readingPosition);
    expect(s.bookId).toBeNull();
    expect(s.position).toBeNull();
  });
});