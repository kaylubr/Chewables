/**
 * SPA-side helpers for Better-Auth Google sign-in.
 *
 * Better-Auth handles the OAuth state + callback and sets the session cookie
 * itself. The SPA POSTs to the backend sign-in endpoint and runs the Google
 * round-trip in a popup window; after the callback the popup posts the session
 * back to the opener, which reads the user via GET /api/auth/me.
 */
import { PUBLIC_API_BASE } from '$env/static/public';
import type { AuthUser } from '@chewable/shared';
import { ApiError } from '../api/client';

const POPUP_NAME = 'chewable-google-auth';
const POPUP_FEATURES = 'popup=yes,width=520,height=620';

export const GOOGLE_AUTH_SOURCE = 'chewable-google-auth';

export type GoogleAuthResult =
	| { status: 'success'; user: AuthUser }
	| { status: 'error'; message: string }
	| { status: 'blocked'; url: string }
	| { status: 'closed' };

export interface GoogleAuthController {
	result: Promise<GoogleAuthResult>;
	/** Close the popup and settle the result as 'closed'. */
	cancel: () => void;
}

/**
 * Start a Google sign-in: POST /sign-in/social and return the provider URL the
 * browser should be redirected to.
 */
export async function googleSignInUrl(next?: string, origin?: string): Promise<string> {
	const spaOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : PUBLIC_API_BASE);
	const callbackURL = `${spaOrigin}/auth-popup.html?api=${encodeURIComponent(PUBLIC_API_BASE)}&next=${encodeURIComponent(next ?? '/profile')}`;

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

/**
 * Size the popup and center it on the screen containing the opener. Browsers
 * otherwise drop script-opened windows near the top-left of the screen. Must
 * run while the popup is still a same-origin blank page, before it navigates
 * to the provider; some browsers ignore move/resize, which is fine.
 */
function centerPopup(popup: Window) {
	try {
		popup.resizeTo(520, 620);
		const x = popup.screenX + Math.round((popup.screen.availWidth - 520) / 2);
		const y = popup.screenY + Math.round((popup.screen.availHeight - 620) / 2);
		popup.moveTo(x, y);
	} catch {
		/* positioning is best-effort */
	}
}

/**
 * Run a Google sign-in in a popup window. Call synchronously from a click
 * handler so the popup is not blocked; the result settles when the popup's
 * callback page posts back, the popup is closed, or the popup is blocked
 * (caller can then fall back to a full-page redirect with the returned url).
 */
export function startGoogleSignIn(next?: string): GoogleAuthController {
	const popup = window.open('', POPUP_NAME, POPUP_FEATURES);
	if (popup) {
		centerPopup(popup);
	}
	let settled = false;
	let graceTimer: number | undefined;
	let intervalId = 0;
	let resolveResult: (outcome: GoogleAuthResult) => void;
	const result = new Promise<GoogleAuthResult>((resolve) => {
		resolveResult = resolve;
	});

	function settle(outcome: GoogleAuthResult) {
		if (settled) return;
		settled = true;
		window.clearInterval(intervalId);
		if (graceTimer !== undefined) window.clearTimeout(graceTimer);
		window.removeEventListener('message', onMessage);
		resolveResult(outcome);
	}

	function onMessage(event: MessageEvent) {
		if (event.origin !== window.location.origin || event.source !== popup) return;
		const data = event.data as { source?: string; status?: string; user?: AuthUser; message?: string } | null;
		if (!data || data.source !== GOOGLE_AUTH_SOURCE) return;
		if (data.status === 'success' && data.user) {
			settle({ status: 'success', user: data.user });
		} else {
			settle({ status: 'error', message: data.message ?? 'Google sign-in did not complete.' });
		}
	}

	window.addEventListener('message', onMessage);
	intervalId = window.setInterval(() => {
		if (!popup || !popup.closed) {
			if (graceTimer !== undefined) {
				window.clearTimeout(graceTimer);
				graceTimer = undefined;
			}
			return;
		}
		if (graceTimer === undefined) {
			graceTimer = window.setTimeout(() => settle({ status: 'closed' }), 1000);
		}
	}, 400);

	async function run() {
		let url: string;
		try {
			url = await googleSignInUrl(next);
		} catch (error) {
			popup?.close();
			settle({
				status: 'error',
				message: error instanceof ApiError ? error.message : 'Could not start Google sign-in. Please retry.',
			});
			return;
		}
		if (settled) return;
		if (!popup) {
			settle({ status: 'blocked', url });
			return;
		}
		if (popup.closed) {
			settle({ status: 'closed' });
			return;
		}
		popup.location.assign(url);
	}
	void run();

	return {
		result,
		cancel: () => {
			popup?.close();
			settle({ status: 'closed' });
		},
	};
}
