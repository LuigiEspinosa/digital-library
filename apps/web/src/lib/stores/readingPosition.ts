import { writable } from "svelte/store";

/**
 * Tracks the current reading position per book.
 * For EPUB: stores CFI string (never a page number).
 * For PDF/comics: stores page number as string.
 */
export interface PositionState {
  bookId: string | null;
  position: string | null;
}

function createPositionStore() {
  const { subscribe, set, update } = writable<PositionState>({
    bookId: null,
    position: null,
  });

  return {
    subscribe,
    setPosition(bookId: string, position: string) {
      update(() => ({ bookId, position }));
    },
    reset() {
      set({ bookId: null, position: null });
    },
  };
}

export const readingPosition = createPositionStore();
