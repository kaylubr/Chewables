import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSignInUrl } from './oauth';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'http://localhost:8000'
}));

describe('googleSignInUrl', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('builds the Better-Auth Google sign-in URL', () => {
		const url = googleSignInUrl();
		expect(url).toBe('http://localhost:8000/api/auth/sign-in/google');
	});

	it('includes callbackURL with a safe next path when given', () => {
		const url = new URL(googleSignInUrl('/photos'));
		expect(url.pathname).toBe('/api/auth/sign-in/google');
		const cb = new URL(decodeURIComponent(url.searchParams.get('callbackURL') ?? ''));
		expect(cb.pathname).toBe('/auth/callback');
		expect(cb.searchParams.get('next')).toBe('/photos');
	});

	it('omits callbackURL when next is not a safe same-origin path', () => {
		const url = googleSignInUrl('//evil.example');
		expect(url).toBe('http://localhost:8000/api/auth/sign-in/google');
	});
});