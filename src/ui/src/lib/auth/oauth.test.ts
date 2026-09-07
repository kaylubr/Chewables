import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oauthAuthorizeUrl, parseOAuthCallback } from './oauth';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'http://localhost:8000'
}));

describe('oauthAuthorizeUrl', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('builds the backend authorize URL for a provider', () => {
		const url = oauthAuthorizeUrl('google');
		expect(url).toBe('http://localhost:8000/api/auth/google/authorize');
	});

	it('includes the next path when given', () => {
		const url = oauthAuthorizeUrl('google', '/photos');
		expect(url).toBe('http://localhost:8000/api/auth/google/authorize?next=%2Fphotos');
	});

	it('omits next when absent', () => {
		const url = oauthAuthorizeUrl('google');
		expect(url.includes('next=')).toBe(false);
	});
});

describe('parseOAuthCallback', () => {
	it('extracts token and user from the fragment', () => {
		const parsed = parseOAuthCallback(
			'http://localhost:5173/auth/callback?next=/photos#token=abc.def&user=%7B%22id%22%3A%22u1%22%2C%22email%22%3A%22a%40b.com%22%2C%22username%22%3A%22alice%22%7D'
		);
		expect(parsed).toEqual({
			token: 'abc.def',
			user: { id: 'u1', email: 'a@b.com', username: 'alice' },
			next: '/photos'
		});
	});

	it('defaults next to /photos', () => {
		const parsed = parseOAuthCallback(
			'http://localhost:5173/auth/callback#token=t&user=%7B%7D'
		);
		expect(parsed?.next).toBe('/photos');
	});

	it('returns null when the token is missing', () => {
		const parsed = parseOAuthCallback('http://localhost:5173/auth/callback#user=%7B%7D');
		expect(parsed).toBeNull();
	});
});
