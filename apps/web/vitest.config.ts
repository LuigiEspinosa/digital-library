import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST }), svelteTesting()],
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