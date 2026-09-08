import { beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';

beforeEach(async () => {
	await db.execute(
		sql`TRUNCATE TABLE "user", session, account, verification, photos RESTART IDENTITY CASCADE`,
	);
});