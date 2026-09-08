/**
 * Test setup: ensures the database starts clean for every test, mirroring the
 * old pytest per-test reset fixtures. The schema is created once by
 * global-setup.ts; here we truncate all tables before each individual test so
 * tests never collide on shared emails/usernames.
 */
import { beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/schema.js';

beforeEach(async () => {
	await db.execute(
		sql`TRUNCATE TABLE "user", session, account, verification, photos RESTART IDENTITY CASCADE`,
	);
});