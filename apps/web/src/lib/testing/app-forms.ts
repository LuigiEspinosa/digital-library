// Test-only stand-in for SvelteKit's $app/forms. vitest.config.ts uses the bare
// svelte() plugin (not sveltekit()), so the real module has no resolver here and a
// route component importing it would throw at render time.
export const enhance = () => ({ destroy() {} });
export const applyAction = async () => {};
export const deserialize = (s: string) => JSON.parse(s);
