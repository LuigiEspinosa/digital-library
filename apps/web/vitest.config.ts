import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST }), svelteTesting()],
  resolve: {
    alias: {
      // Both aliases resolve against this config file, not the cwd: the root
      // `pnpm test` (the CI repro) runs vitest.workspace.ts from the repo root, where
      // a bare path.resolve('./src/…') points outside apps/web and fails to resolve.
      '$lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$app/forms': fileURLToPath(new URL('./src/lib/testing/app-forms.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})