/**
 * Photo business logic: save, list, fetch, and delete saved photos.
 *
 * A saved photo is the final composed photobooth image uploaded by an
 * authenticated user. The image goes to object storage under a server-
 * generated key; only metadata lives in Postgres. Every operation enforces
 * ownership — the current user comes from the session, never from a
 * client-supplied id. Ordering follows ADR 0006: object store first, then DB
 * row on create; DB row first, then object on delete.
 */
import { randomUUID } from 'node:crypto';
import type { Storage } from '../../adapters/storage/storage.js';
import { storage } from '../../adapters/storage/storage.js';
import { isSupportedFrame } from '../../lib/frames.js';
import { db, schema } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { SavedPhoto } from '@chewable/shared';

// Upload validation
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export class InvalidFrameError extends Error {
	override name = 'InvalidFrameError';
}

export class InvalidImageError extends Error {
	override name = 'InvalidImageError';
}

export class PhotoNotFoundError extends Error {
	override name = 'PhotoNotFoundError';
}

export type { StorageError as PhotoStorageError } from '../../adapters/storage/storage.js';

/** Server-generated key; clients never choose storage paths. */
export function storageKeyFor(userId: string, photoId: string): string {
	return `users/${userId}/photos/${photoId}.webp`;
}

export function validateUpload(contentType: string | undefined, size: number): void {
	if (!contentType || !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
		throw new InvalidImageError(
			`unsupported content type ${contentType ?? ''}; expected one of ${ALLOWED_CONTENT_TYPES.join(', ')}`,
		);
	}
	if (size <= 0) throw new InvalidImageError('empty upload');
	if (size > MAX_UPLOAD_BYTES) {
		throw new InvalidImageError(`upload exceeds ${MAX_UPLOAD_BYTES} byte limit`);
	}
}

export async function createPhoto(input: {
	userId: string;
	frame: string;
	imageBytes: Uint8Array;
	contentType: string;
	store?: Storage;
}): Promise<SavedPhoto> {
	const store = input.store ?? storage;
	if (!isSupportedFrame(input.frame)) {
		throw new InvalidFrameError(`unsupported frame identifier: ${input.frame}`);
	}
	validateUpload(input.contentType, input.imageBytes.byteLength);

	const photoId = randomUUID();
	const key = storageKeyFor(input.userId, photoId);

	try {
		await store.put(key, input.imageBytes, input.contentType);
	} catch (error) {
		// Nothing persisted yet — nothing to clean up.
		throw error;
	}

	try {
		const inserted = await db
			.insert(schema.photos)
			.values({
				id: photoId,
				userId: input.userId,
				frame: input.frame,
				storageKey: key,
			})
			.returning();
		const row = inserted[0];
		if (!row) throw new Error('photo insert returned no row');
		return rowsToSavedPhoto(row);
	} catch (error) {
		// Do not leave an orphaned object if the DB write fails.
		await store.delete(key).catch(() => undefined);
		throw error;
	}
}

export async function listUserPhotos(userId: string): Promise<SavedPhoto[]> {
	const rows = await db
		.select()
		.from(schema.photos)
		.where(eq(schema.photos.userId, userId))
		.orderBy(schema.photos.createdAt);
	return rows.map(rowsToSavedPhoto);
}

export async function getOwnedPhoto(userId: string, photoId: string): Promise<PhotoRow> {
	const row = await db
		.select()
		.from(schema.photos)
		.where(and(eq(schema.photos.id, photoId), eq(schema.photos.userId, userId)))
		.limit(1);
	const photo = row[0];
	if (!photo) throw new PhotoNotFoundError();
	return photo;
}

/** Delete the object-storage image and the DB row (row first, then object). */
export async function deletePhoto(input: {
	userId: string;
	photoId: string;
	store?: Storage;
}): Promise<void> {
	const store = input.store ?? storage;
	const photo = await getOwnedPhoto(input.userId, input.photoId);
	await db.delete(schema.photos).where(eq(schema.photos.id, photo.id));
	await store.delete(photo.storageKey);
}

export interface PhotoRow {
	id: string;
	userId: string;
	frame: string;
	storageKey: string;
	createdAt: Date;
}

function rowsToSavedPhoto(row: PhotoRow): SavedPhoto {
	return {
		id: row.id,
		frame: row.frame,
		storageKey: row.storageKey,
		createdAt: row.createdAt.toISOString(),
	};
}