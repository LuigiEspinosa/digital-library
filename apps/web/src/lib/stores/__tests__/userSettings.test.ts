import { describe, test, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { userSettings } from '../userSettings';

describe('userSettings store', () => {
  beforeEach(() => {
    // Reset to known defaults using the store's own API
    userSettings.set('theme', 'sepia');
    userSettings.set('fontSize', 18);
    userSettings.set('fontFamily', 'Georgia, serif');
    userSettings.set('lineHeight', 1.6);
  });

  test('set() updates the target key', () => {
    userSettings.set('theme', 'dark');
    expect(get(userSettings).theme).toBe('dark');
  });

  test('set() does not affect sibling keys', () => {
    userSettings.set('theme', 'dark');
    const s = get(userSettings);
    expect(s.fontSize).toBe(18);
    expect(s.fontFamily).toBe('Georgia, serif');
    expect(s.lineHeight).toBe(1.6);
  });

  test('all three theme values are accepted', () => {
    for (const theme of ['light', 'sepia', 'dark'] as const) {
      userSettings.set('theme', theme);
      expect(get(userSettings).theme).toBe(theme);
    }
  });

  test('fontSize update does not disturb other keys', () => {
    userSettings.set('fontSize', 24);
    const s = get(userSettings);
    expect(s.fontSize).toBe(24);
    expect(s.theme).toBe('sepia');
  });
});