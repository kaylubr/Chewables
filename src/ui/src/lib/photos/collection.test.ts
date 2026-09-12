import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { PhotoCollection } from './collection.svelte';

const { listPhotos, photoUrl, deletePhoto } = vi.hoisted(() => ({
	listPhotos: vi.fn(),
	photoUrl: vi.fn(),
	deletePhoto: vi.fn()
}));

vi.mock('../api/client', async () => {
	const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
	return {
		ApiError: actual.ApiError,
		api: { listPhotos, photoUrl, deletePhoto }
	};
});

function photo(id: string, createdAt = '2026-01-01T00:00:00.000Z') {
	return { id, frame: 'FILM', storageKey: `users/u/photos/${id}.webp`, createdAt };
}

beforeEach(() => {
	vi.clearAllMocks();
	photoUrl.mockImplementation(async (id: string) => ({ url: `signed/${id}` }));
	deletePhoto.mockResolvedValue(undefined);
});

describe('PhotoCollection.load', () => {
	it('shows every photo in API order, each with a signed URL', async () => {
		listPhotos.mockResolvedValue([photo('a'), photo('b')]);
		const collection = new PhotoCollection();

		await collection.load();

		expect(collection.photos.map((p) => p.id)).toEqual(['a', 'b']);
		expect(collection.photos.map((p) => p.displayUrl)).toEqual(['signed/a', 'signed/b']);
		expect(collection.loading).toBe(false);
		expect(collection.failed).toBe(false);
		expect(collection.isEmpty).toBe(false);
	});

	it('keeps only the newest `limit` photos, newest first', async () => {
		listPhotos.mockResolvedValue([
			photo('a', '2026-01-01T00:00:00.000Z'),
			photo('b', '2026-01-02T00:00:00.000Z'),
			photo('c', '2026-01-03T00:00:00.000Z')
		]);
		const collection = new PhotoCollection();

		await collection.load(2);

		expect(collection.photos.map((p) => p.id)).toEqual(['c', 'b']);
	});

	it('keeps a photo whose URL could not be signed, without making it viewable', async () => {
		listPhotos.mockResolvedValue([photo('a'), photo('b')]);
		photoUrl.mockImplementation(async (id: string) => {
			if (id === 'b') throw new ApiError(503, 'storage down');
			return { url: 'signed/a' };
		});
		const collection = new PhotoCollection();

		await collection.load();

		expect(collection.photos.map((p) => p.displayUrl)).toEqual(['signed/a', undefined]);
		expect(collection.viewable.map((p) => p.id)).toEqual(['a']);
		expect(collection.failed).toBe(false);
	});

	it('records the failure and empties the grid when the list request fails', async () => {
		listPhotos.mockRejectedValue(new ApiError(401, 'Not authenticated'));
		const collection = new PhotoCollection();

		await collection.load();

		expect(collection.failed).toBe(true);
		expect(collection.failureMessage).toBe('Not authenticated');
		expect(collection.photos).toEqual([]);
		expect(collection.loading).toBe(false);
		// A failed load is not the "no photos yet" empty state.
		expect(collection.isEmpty).toBe(false);
	});

	it('reports the empty state only after a successful load with no photos', async () => {
		listPhotos.mockResolvedValue([]);
		const collection = new PhotoCollection();

		await collection.load();

		expect(collection.isEmpty).toBe(true);
	});
});

describe('PhotoCollection.remove', () => {
	it('deletes the photo and drops it from the grid', async () => {
		listPhotos.mockResolvedValue([photo('a'), photo('b')]);
		const collection = new PhotoCollection();
		await collection.load();

		await collection.remove('a');

		expect(deletePhoto).toHaveBeenCalledWith('a');
		expect(collection.photos.map((p) => p.id)).toEqual(['b']);
	});

	it('leaves the grid alone when the delete fails', async () => {
		listPhotos.mockResolvedValue([photo('a'), photo('b')]);
		deletePhoto.mockRejectedValue(new ApiError(500, 'nope'));
		const collection = new PhotoCollection();
		await collection.load();

		await expect(collection.remove('a')).rejects.toThrow('nope');
		expect(collection.photos.map((p) => p.id)).toEqual(['a', 'b']);
	});
});

describe('PhotoCollection.viewerIndex', () => {
	it('maps a photo to its position among the signed photos, or -1', async () => {
		listPhotos.mockResolvedValue([photo('a'), photo('b')]);
		photoUrl.mockImplementation(async (id: string) => {
			if (id === 'a') throw new ApiError(503, 'storage down');
			return { url: 'signed/b' };
		});
		const collection = new PhotoCollection();
		await collection.load();

		expect(collection.viewerIndex('b')).toBe(0);
		expect(collection.viewerIndex('a')).toBe(-1);
	});
});
