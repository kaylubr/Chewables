import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	test: {
		globals: true,
		environment: 'node',
		include: ['auth/**/*.test.ts', 'photos/**/*.test.ts'],
		globalSetup: './utils/test/global-setup.ts',
		setupFiles: ['./utils/test/setup.ts'],
		testTimeout: 20000,
		hookTimeout: 30000,
		fileParallelism: false,
	},
});