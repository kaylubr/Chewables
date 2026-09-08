import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { config } from '../../config.js';

export async function resetDatabase(): Promise<void> {
	await db.execute(sql`DROP SCHEMA public CASCADE`);
	await db.execute(sql`CREATE SCHEMA public`);
	const { createTables } = await import('./create-tables.js');
	await createTables();
}

export function testConfig() {
	return config;
}