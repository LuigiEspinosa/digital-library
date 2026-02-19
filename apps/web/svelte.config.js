import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node produces a standalone Node.js server
		// required for Docker deployment on a VPS
		adapter: adapter({ out: "build" }),
		alias: {
			"@digital-library/shared": "../../packages/shared/src/index.ts",
		},
	},
};

export default config;
