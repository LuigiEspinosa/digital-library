import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: "build" }),
		alias: {
			// Vite resolves this at bundle time. Points to TS source so Vite's
			// transpiler handles it directly - no separate build step needed
			// for the shared package during development.
			"@digital-library/shared": "../../packages/shared/src/index.ts",
		},
	},
};

export default config;
