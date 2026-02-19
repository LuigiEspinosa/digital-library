import { writable } from 'svelte/store';
import type { User } from '@digital-library/shared';

/** The currently authenticated user, or null if logged out. */
export const currentUser = writable<User | null>(null);
