import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Dev-only smoke surface: hard 404 in production so the route never enumerates.
export const load: PageServerLoad = () => {
	if (!dev) {
		error(404, 'Not Found');
	}
	return {};
};
