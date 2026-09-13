import { randomUUID } from "node:crypto";
import { PHOTO_CONTENT_TYPES, type SavedPhoto } from "@chewable/shared";
import type { Photo } from "../db/index.js";
import { storage, type Storage } from "../adapters/storage/storage.js";
import { isSupportedFrame } from "../lib/frames.js";
import type { CreatePhotoInput } from "../types/index.js";
import * as PhotoRepo from "./photos.repo.js";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export class InvalidFrameError extends Error {
  override name = "InvalidFrameError";
}

export class InvalidImageError extends Error {
  override name = "InvalidImageError";
}

export class PhotoNotFoundError extends Error {
  override name = "PhotoNotFoundError";
}

export function storageKeyFor(userId: string, photoId: string): string {
  return `users/${userId}/photos/${photoId}.webp`;
}

export function validateUpload(
  contentType: string | undefined,
  size: number,
): void {
  if (
    !contentType ||
    !(PHOTO_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    throw new InvalidImageError(
      `unsupported content type ${contentType ?? ""}; expected one of ${PHOTO_CONTENT_TYPES.join(", ")}`,
    );
  }
  if (size <= 0) throw new InvalidImageError("empty upload");
  if (size > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError(
      `upload exceeds ${MAX_UPLOAD_BYTES} byte limit`,
    );
  }
}

export async function createPhoto(
  input: CreatePhotoInput & { store?: Storage },
): Promise<SavedPhoto> {
  const store = input.store ?? storage;
  if (!isSupportedFrame(input.frame)) {
    throw new InvalidFrameError(`unsupported frame identifier: ${input.frame}`);
  }
  validateUpload(input.contentType, input.imageBytes.byteLength);

  const photoId = randomUUID();
  const key = storageKeyFor(input.userId, photoId);

  await store.put(key, input.imageBytes, input.contentType);

  try {
    const inserted = await PhotoRepo.insertPhoto({
      id: photoId,
      userId: input.userId,
      frame: input.frame,
      storageKey: key,
    });
    const row = inserted[0];
    if (!row) throw new Error("photo insert returned no row");
    return rowsToSavedPhoto(row);
  } catch (error) {
    await store.delete(key).catch(() => undefined);
    throw error;
  }
}

export async function listUserPhotos(userId: string): Promise<SavedPhoto[]> {
  const rows = await PhotoRepo.findByUserId(userId);
  return rows.map(rowsToSavedPhoto);
}

export async function getPhotoUrl(
  userId: string,
  photoId: string,
  store: Storage = storage,
): Promise<string> {
  const row = await PhotoRepo.findOwnedById(userId, photoId);
  const photo = row[0];
  if (!photo) throw new PhotoNotFoundError();
  return store.url(photo.storageKey);
}

export async function deletePhoto(input: {
  userId: string;
  photoId: string;
  store?: Storage;
}): Promise<void> {
  const store = input.store ?? storage;
  const row = await PhotoRepo.findOwnedById(input.userId, input.photoId);
  const photo = row[0];
  if (!photo) throw new PhotoNotFoundError();
  await PhotoRepo.deletePhotoById(photo.id);
  await store.delete(photo.storageKey);
}

export async function listUserStorageKeys(userId: string): Promise<string[]> {
  const rows = await PhotoRepo.findByUserId(userId);
  return rows.map((row) => row.storageKey);
}

export async function deleteStoredObjects(
  keys: string[],
  store: Storage = storage,
): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      store.delete(key).catch((error) => {
        console.error(`[photos] failed to delete stored object ${key}`, error);
      }),
    ),
  );
}

function rowsToSavedPhoto(row: Photo): SavedPhoto {
  return {
    id: row.id,
    frame: row.frame,
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString(),
  };
}
