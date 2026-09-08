/**
 * SPA-side helpers for Better-Auth Google sign-in.
 *
 * Better-Auth handles the OAuth state + callback and sets the session cookie
 * itself. The SPA links to the backend sign-in endpoint; after the callback
 * the browser is back on the same origin with a valid session, so the app
 * reads it via GET /api/auth/me.
 */
import { PUBLIC_API_BASE } from '$env/static/public';

/** Build the backend Google sign-in URL the browser is redirected to. */
export function googleSignInUrl(next?: string): string {
	const url = new URL(`${PUBLIC_API_BASE}/api/auth/sign-in/google`);
	if (next && next.startsWith('/') && !next.startsWith('//')) {
		url.searchParams.set('callbackURL', `${PUBLIC_API_BASE}/auth/callback?next=${encodeURIComponent(next)}`);
	}
	return url.toString();
}