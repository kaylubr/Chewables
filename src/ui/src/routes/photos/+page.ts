import { redirect } from '@sveltejs/kit';

// The photo gallery now lives on the profile page.
export function load() {
	redirect(307, '/profile');
}