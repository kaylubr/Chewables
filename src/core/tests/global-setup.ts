/**
 * Global test setup: creates the test schema once before any test file runs.
 * Per-file setup (tests/setup.ts) then truncates tables between files so
 * tests start clean without racing the schema DDL.
 */
import { resetDatabase } from './test-db.js';

export default async function globalSetup(): Promise<void> {
	await resetDatabase();
}

export const teardown = undefined;