import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: true, // bind to 0.0.0.0 so Docker can expose the port
    port: 3000, // match the port Caddy expects (reverse_proxy web:3000)
  },
});
