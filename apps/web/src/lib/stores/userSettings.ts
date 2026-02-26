import { writable } from "svelte/store";

export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ComicLayout = 'single' | 'dual' | 'webtoon';

export interface UserSettings {
  theme: ReaderTheme;
  fontSize: number;           // px
  fontFamily: string;
  lineHeight: number;         // unitless multiplier
  comicLayout: ComicLayout;
  comicRtl: boolean;
}

const STORAGE_KEY = 'dl_reader_settings';

const defaults: UserSettings = {
  theme: 'sepia',
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.6,
  comicLayout: 'dual',
  comicRtl: false,
}

function loadSettings(): UserSettings {
  if (typeof localStorage === 'undefined') return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults }
  }
}

function createSettingsStore() {
  const { subscribe, update } = writable<UserSettings>(loadSettings());

  return {
    subscribe,
    set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
      update((s) => {
        const next = { ...s, [key]: value };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* Ignore storage quota errors */ }
        return next;
      });
    },
  };
}

export const userSettings = createSettingsStore();
