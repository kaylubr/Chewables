import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleSignInUrl } from './oauth';
import { ApiError } from '../api/client';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'http://localhost:8000'
}));

describe('googleSignInUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubFetch(ok: boolean, body: unknown) {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }))
		);
	}

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
		expect(body.callbackURL).toBe('http://localhost:5173/auth/callback?next=%2Fphotos');
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
