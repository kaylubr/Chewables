import type { Storage } from './storage.js';

export interface InMemoryStorage extends Storage {
	keys(): string[];
	has(key: string): boolean;
}

export function inMemoryStorage(): InMemoryStorage {
	const objects = new Map<string, Uint8Array>();
	return {
		async ensureBucket(): Promise<void> {},
		async put(key, body): Promise<void> {
			objects.set(key, body);
		},
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
