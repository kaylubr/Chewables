/**
 * In-memory object-storage adapter, for tests.
 *
 * The production adapter is S3-compatible (MinIO in dev); this one satisfies
 * the same `Storage` seam so a test can assert what the photos domain stores
 * and deletes without touching a network bucket.
 */
import type { Storage } from './storage.js';

export interface InMemoryStorage extends Storage {
	/** The keys currently held, for assertions. */
	keys(): string[];
	/** Whether a key is currently held. */
	has(key: string): boolean;
}

export function inMemoryStorage(): InMemoryStorage {
	const objects = new Map<string, Uint8Array>();
	return {
		async ensureBucket(): Promise<void> {},
		async put(key, body): Promise<void> {
			objects.set(key, body);
		},
		// DeleteObject is idempotent in S3, so a missing key is not an error.
		async delete(key): Promise<void> {
			objects.delete(key);
		},
		async url(key): Promise<string> {
			if (!objects.has(key)) throw new Error(`no such object: ${key}`);
			return `memory://${key}`;
		},
		keys: () => [...objects.keys()],
		has: (key) => objects.has(key),
	};
}
