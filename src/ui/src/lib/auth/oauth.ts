/**
 * SPA-side helpers for Better-Auth Google sign-in.
 *
 * Better-Auth handles the OAuth state + callback and sets the session cookie
 * itself. The SPA POSTs to the backend sign-in endpoint and navigates to the
 * returned Google authorization URL; after the callback the browser is back on
 * the SPA with a valid session, which the app reads via GET /api/auth/me.
 */
import { PUBLIC_API_BASE } from '$env/static/public';
import { ApiError } from '../api/client';

/**
 * Start a Google sign-in: POST /sign-in/social and return the provider URL the
 * browser should be redirected to.
 */
export async function googleSignInUrl(next?: string, origin?: string): Promise<string> {
	const spaOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : PUBLIC_API_BASE);
	const callbackURL = `${spaOrigin}/auth/callback?next=${encodeURIComponent(next ?? '/photos')}`;

	const res = await fetch(`${PUBLIC_API_BASE}/api/auth/sign-in/social`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			provider: 'google',
			callbackURL: next && next.startsWith('/') && !next.startsWith('//') ? callbackURL : undefined,
		}),
	});
	if (!res.ok) {
		let detail = res.statusText;
		try {
			const body = await res.json();
			if (typeof body.message === 'string') detail = body.message;
		} catch {
			/* keep statusText */
		}
		throw new ApiError(res.status, detail);
	}
	const data = (await res.json()) as { url?: string };
	return data.url ?? '';
}
