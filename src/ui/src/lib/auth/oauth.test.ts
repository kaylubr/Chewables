import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleSignInUrl, startGoogleSignIn, GOOGLE_AUTH_SOURCE } from './oauth';
import { ApiError } from '../api/client';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'http://localhost:8000'
}));

const USER = { id: 'u1', email: 'a@b.com', username: 'alice' };

function stubFetch(ok: boolean, body: unknown) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }))
	);
}

describe('googleSignInUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('POSTs to the Better-Auth social sign-in endpoint and returns the provider URL', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/o/oauth2/auth?state=abc', redirect: true });
		const url = await googleSignInUrl('/photos', 'http://localhost:5173');
		expect(url).toBe('https://accounts.google.com/o/oauth2/auth?state=abc');
		const [requestUrl, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(requestUrl).toBe('http://localhost:8000/api/auth/sign-in/social');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('include');
		const body = JSON.parse(init.body as string);
		expect(body.provider).toBe('google');
		expect(body.callbackURL).toBe(
			'http://localhost:5173/auth-popup.html?api=http%3A%2F%2Flocalhost%3A8000&next=%2Fphotos'
		);
	});

	it('omits callbackURL when next is not a safe same-origin path', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/', redirect: true });
		await googleSignInUrl('//evil.example', 'http://localhost:5173');
		const [requestUrl, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(requestUrl).toBe('http://localhost:8000/api/auth/sign-in/social');
		const body = JSON.parse(init.body as string);
		expect(body.callbackURL).toBeUndefined();
	});

	it('throws ApiError when the request fails', async () => {
		stubFetch(false, { message: 'Provider not found' });
		await expect(googleSignInUrl('/photos', 'http://localhost:5173')).rejects.toThrow(ApiError);
		await expect(googleSignInUrl('/photos', 'http://localhost:5173')).rejects.toThrow(
			'Provider not found'
		);
	});
});

describe('startGoogleSignIn', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function fakePopup(closed = false) {
		return {
			closed,
			close: vi.fn(),
			location: { assign: vi.fn() },
		};
	}

	function stubOpen(popup: unknown) {
		vi.stubGlobal('open', vi.fn(() => popup));
	}

	it('reports blocked with the provider URL when the popup is denied', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth', redirect: true });
		stubOpen(null);
		const { result } = startGoogleSignIn('/photos');
		await expect(result).resolves.toEqual({ status: 'blocked', url: 'https://accounts.google.com/auth' });
	});

	it('directs the popup to the provider URL and settles on the posted user', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth?state=s1', redirect: true });
		const popup = fakePopup();
		stubOpen(popup);
		const addSpy = vi.spyOn(window, 'addEventListener');

		const { result } = startGoogleSignIn('/photos');
		await vi.waitFor(() =>
			expect(popup.location.assign).toHaveBeenCalledWith('https://accounts.google.com/auth?state=s1')
		);
		const handler = addSpy.mock.calls.find(([type]) => type === 'message')?.[1] as (
			event: MessageEvent
		) => void;
		handler({
			origin: window.location.origin,
			source: popup,
			data: { source: GOOGLE_AUTH_SOURCE, status: 'success', user: USER },
		} as unknown as MessageEvent);

		await expect(result).resolves.toEqual({ status: 'success', user: USER });
	});

	it('settles as closed when the popup is closed before the callback', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth', redirect: true });
		stubOpen(fakePopup(true));
		const { result } = startGoogleSignIn('/photos');
		await expect(result).resolves.toEqual({ status: 'closed' });
	});

	it('cancel closes the popup and settles as closed', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth', redirect: true });
		const popup = fakePopup();
		stubOpen(popup);
		const { result, cancel } = startGoogleSignIn('/photos');
		cancel();
		await expect(result).resolves.toEqual({ status: 'closed' });
		expect(popup.close).toHaveBeenCalled();
	});

	it('settles as error when the callback page reports failure', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth', redirect: true });
		const popup = fakePopup();
		stubOpen(popup);
		const addSpy = vi.spyOn(window, 'addEventListener');

		const { result } = startGoogleSignIn('/photos');
		const handler = addSpy.mock.calls.find(([type]) => type === 'message')?.[1] as (
			event: MessageEvent
		) => void;
		handler({
			origin: window.location.origin,
			source: popup,
			data: { source: GOOGLE_AUTH_SOURCE, status: 'error', message: 'Nope' },
		} as unknown as MessageEvent);

		await expect(result).resolves.toEqual({ status: 'error', message: 'Nope' });
	});

	it('ignores messages from other windows', async () => {
		stubFetch(true, { url: 'https://accounts.google.com/auth', redirect: true });
		const popup = fakePopup();
		stubOpen(popup);
		const addSpy = vi.spyOn(window, 'addEventListener');

		const { result, cancel } = startGoogleSignIn('/photos');
		const handler = addSpy.mock.calls.find(([type]) => type === 'message')?.[1] as (
			event: MessageEvent
		) => void;
		handler({
			origin: window.location.origin,
			source: { close: vi.fn(), location: { assign: vi.fn() } },
			data: { source: GOOGLE_AUTH_SOURCE, status: 'success', user: USER },
		} as unknown as MessageEvent);
		handler({
			origin: 'https://evil.example',
			source: popup,
			data: { source: GOOGLE_AUTH_SOURCE, status: 'success', user: USER },
		} as unknown as MessageEvent);

		cancel();
		await expect(result).resolves.toEqual({ status: 'closed' });
		expect(popup.location.assign).not.toHaveBeenCalled();
	});
});
