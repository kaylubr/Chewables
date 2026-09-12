/**
 * State behind a grid of saved photos.
 *
 * The gallery (/photos) and the profile's recent strip behave the same way:
 * list the user's photos, hand each one a signed URL so its tile can show it,
 * and drop one on delete. They differ only in how many they show. Keeping
 * that here means the signed-URL fallback and the viewer's index mapping live
 * in one place rather than in both pages.
 */
import type { SavedPhoto } from '@chewable/shared';
import { ApiError, api } from '../api/client';

export type DisplayPhoto = SavedPhoto & { displayUrl?: string };

/** A photo with a signed URL the viewer can open. */
export interface ViewablePhoto {
	id: string;
	url: string;
}

/** Sign one photo's URL; on failure the tile falls back to a placeholder. */
async function sign(photo: SavedPhoto): Promise<DisplayPhoto> {
	try {
		const { url } = await api.photoUrl(photo.id);
		return { ...photo, displayUrl: url };
	} catch {
		return { ...photo, displayUrl: undefined };
	}
}

export class PhotoCollection {
	photos = $state<DisplayPhoto[]>([]);
	loading = $state(true);
	failed = $state(false);
	/** Detail from the failed load, for a caller that reports it (e.g. a toast). */
	failureMessage = $state('');

	/** True only once loading finished with no photos and no failure. */
	get isEmpty(): boolean {
		return !this.loading && !this.failed && this.photos.length === 0;
	}

	/** Photos that have a signed URL, in display order, for the viewer. */
	get viewable(): ViewablePhoto[] {
		return this.photos
			.filter((p): p is DisplayPhoto & { displayUrl: string } => Boolean(p.displayUrl))
			.map((p) => ({ id: p.id, url: p.displayUrl }));
	}

	/**
	 * Load the user's photos. With `limit`, keep the newest few and show them
	 * newest-first (the API returns them oldest-first); without it, show all
	 * of them in API order.
	 */
	async load(limit?: number): Promise<void> {
		this.failed = false;
		this.failureMessage = '';
		this.loading = true;
		try {
			const data = await api.listPhotos();
			const chosen = limit === undefined ? data : data.slice(-limit).reverse();
			this.photos = await Promise.all(chosen.map(sign));
		} catch (error) {
			this.failed = true;
			this.failureMessage = error instanceof ApiError ? error.message : '';
			this.photos = [];
		} finally {
			this.loading = false;
		}
	}

	/** Delete a photo and drop it from the grid. */
	async remove(id: string): Promise<void> {
		await api.deletePhoto(id);
		this.photos = this.photos.filter((p) => p.id !== id);
	}

	/** Position of a photo in `viewable`, or -1 when it has no signed URL. */
	viewerIndex(id: string): number {
		return this.viewable.findIndex((p) => p.id === id);
	}
}
