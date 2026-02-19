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

const defaults: UserSettings = {
  theme: 'sepia',
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.6,
  comicLayout: 'dual',
  comicRtl: false,
}

function createSettingsStore() {
  const { subscribe, update } = writable<UserSettings>({ ...defaults });

  return {
    subscribe,
    set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
      update((s) => ({ ...s, [key]: value }));
    },
  };
}

export const userSettings = createSettingsStore();
