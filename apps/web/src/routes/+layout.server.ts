import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/api';

export const load: LayoutServerLoad = async ({ request }) => {
  // Forward the browser's cookie header to the API so SSR can validate
  // the session and return the current user to every page's data.
  const cookie = request.headers.get('cookie') ?? '';
  const user = await getSessionUser(cookie);
  return { user };
}
