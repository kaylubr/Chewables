import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('api client', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uploadPhoto sends the frame and image as multipart with cookies', async () => {
		let captured: { url: string; init: RequestInit } | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init: RequestInit) => {
				captured = { url, init };
				return jsonResponse(201, {
					id: 'p1',
					frame: 'FILM',
					storageKey: 'users/u1/photos/p1.webp',
					createdAt: '2026-09-05T00:00:00Z'
				});
			})
		);

		const blob = new Blob(['webp-data'], { type: 'image/webp' });
		const result = await api.uploadPhoto('FILM', blob);

		expect(result.id).toBe('p1');
		expect(captured!.url).toContain('/api/photos');
		expect(captured!.init.method).toBe('POST');
		expect(captured!.init.credentials).toBe('include');
		expect(captured!.init.body).toBeInstanceOf(FormData);
		const form = captured!.init.body as FormData;
		expect(form.get('frame')).toBe('FILM');
	});

	it('listPhotos sends credentials and returns photos', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse(200, [
					{ id: 'p1', frame: 'FILM', storageKey: 'k', createdAt: '2026-09-05T00:00:00Z' }
				])
			)
		);
		const photos = await api.listPhotos();
		expect(photos).toHaveLength(1);
		const call = vi.mocked(fetch).mock.calls[0];
		expect(call[1]!.credentials).toBe('include');
	});

	it('deletePhoto sends DELETE with credentials', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
		await api.deletePhoto('p1');
		const call = vi.mocked(fetch).mock.calls[0];
		expect(call[0]).toContain('/api/photos/p1');
		expect(call[1]!.method).toBe('DELETE');
		expect(call[1]!.credentials).toBe('include');
	});

	it('maps an API error detail into ApiError with its status', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse(401, { detail: 'Incorrect username or password' }))
		);
		await expect(api.login('someuser', 'wrong')).rejects.toMatchObject({
			status: 401,
			message: 'Incorrect username or password'
		});
	});

	it('surfaces non-JSON error bodies with a fallback message', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
		try {
			await api.listPhotos();
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
		}
	});

	it('me returns null on 401', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { detail: 'Not authenticated' })));
		expect(await api.me()).toBeNull();
	});
});