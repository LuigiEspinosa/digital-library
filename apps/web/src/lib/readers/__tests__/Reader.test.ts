import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Reader from '../Reader.svelte';
import type { Book } from '@digital-library/shared';

// Prevent epubjs from touching canvas / window at import time
vi.mock('epubjs', () => ({
  default: vi.fn().mockReturnValue({
    renderTo: vi.fn().mockReturnValue({
      themes: {
        register: vi.fn(),
        select: vi.fn(),
        override: vi.fn(),
      },
      display: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      destroy: vi.fn(),
      getContents: vi.fn().mockReturnValue([]),
      next: vi.fn(),
      prev: vi.fn(),
    }),
  }),
}));

function makeBook(format: string): Book {
  return {
    id: 'book-1',
    library_id: 'lib-1',
    title: 'Test Book',
    format: format as Book['format'],
    file_path: '/data/books/test',
    created_at: '2024-01-01T00:00:00.000Z',
  };
}

describe('Reader', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders PDF placeholder for pdf format', () => {
    render(Reader, { props: { book: makeBook('pdf') } });
    expect(screen.getByText(/pdf reader/i)).toBeTruthy();
  });

  test('renders comic placeholder for cbz format', () => {
    render(Reader, { props: { book: makeBook('cbz') } });
    expect(screen.getByText(/comic reader/i)).toBeTruthy();
  });

  test('renders comic placeholder for cbr format', () => {
    render(Reader, { props: { book: makeBook('cbr') } });
    expect(screen.getByText(/comic reader/i)).toBeTruthy();
  });

  test('renders unsupported message for unknown format', () => {
    render(Reader, { props: { book: makeBook('txt') } });
    expect(screen.getByText(/unsupported format/i)).toBeTruthy();
  });

  test('mounts EpubReader for epub format without throwing', () => {
    expect(() =>
      render(Reader, { props: { book: makeBook('epub') } })
    ).not.toThrow();
  });
});