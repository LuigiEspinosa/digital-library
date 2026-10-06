// Test-only stand-in for SvelteKit's $app/navigation. vitest.config.ts uses the
// bare svelte() plugin (not sveltekit()), so the real module has no resolver here
// and a route component importing it would throw at render time. Same reason and
// same shape as app-forms.ts.
export const goto = async () => {};
export const invalidate = async () => {};
export const invalidateAll = async () => {};
export const preloadData = async () => ({ type: 'loaded' as const, status: 200, data: {} });
export const preloadCode = async () => {};
export const beforeNavigate = () => {};
export const afterNavigate = () => {};
export const onNavigate = () => {};
export const pushState = () => {};
export const replaceState = () => {};
