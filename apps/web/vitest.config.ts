import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})