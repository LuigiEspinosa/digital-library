import { defineConfig } from 'vitest/config';

// Projects are declared in vitest.workspace.ts so each package's own config
// (notably apps/web's Svelte plugin) actually applies. The inline test.projects
// key only takes effect in vitest >=3.2; this repo's root vitest is 2.x, where it
// is silently ignored — which dropped the Svelte transform and broke component tests.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});