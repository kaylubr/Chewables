import type { SavedPhoto } from '@chewable/shared';
import { ApiError, api } from '../api/client';

export type DisplayPhoto = SavedPhoto & { displayUrl?: string };

export interface ViewablePhoto {
	id: string;
	url: string;
}

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
	failureMessage = $state('');

	get isEmpty(): boolean {
		return !this.loading && !this.failed && this.photos.length === 0;
	}

	get viewable(): ViewablePhoto[] {
		return this.photos
			.filter((p): p is DisplayPhoto & { displayUrl: string } => Boolean(p.displayUrl))
			.map((p) => ({ id: p.id, url: p.displayUrl }));
	}

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

	async remove(id: string): Promise<void> {
		await api.deletePhoto(id);
		this.photos = this.photos.filter((p) => p.id !== id);
	}

	viewerIndex(id: string): number {
		return this.viewable.findIndex((p) => p.id === id);
	}
}
