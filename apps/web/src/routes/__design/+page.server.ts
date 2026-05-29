import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// * Failure mode: without this gate, /__design enumerates in production
// * (sitemaps, accidental links, dev-tool route inspection). The page is
// * a developer surface for the WIRED token layer (story 01.A.4) and is
// * not part of the product, so the only correct production behavior is
// * a hard 404 before SSR.
// * Roads not taken: client-side guard inside +page.svelte (HTML still
// * SSRs before the guard fires); Vite `define`-based exclusion (would
// * spread the cutover into vite.config.ts beyond this story's scope).
// * Long-term cost: one more file to delete at the close of Epic 01,
// * tracked in the apply checklist's "Follow-ups" section.
export const load: PageServerLoad = () => {
	if (!dev) {
		error(404, 'Not Found');
	}
	return {};
};
