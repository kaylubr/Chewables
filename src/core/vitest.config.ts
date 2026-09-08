import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		globalSetup: './tests/global-setup.ts',
		setupFiles: ['./tests/setup.ts'],
		testTimeout: 20000,
		hookTimeout: 30000,
		// Files share a single test database; run them serially so their
		// per-file truncates don't race each other's inserts.
		fileParallelism: false,
	},
});