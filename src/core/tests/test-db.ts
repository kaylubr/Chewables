/**
 * Test database reset. Drops all tables and recreates them so each test
 * starts from a clean schema, mirroring the old pytest per-test reset.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/schema.js';
import { config } from '../config.js';

export async function resetDatabase(): Promise<void> {
	await db.execute(sql`DROP SCHEMA public CASCADE`);
	await db.execute(sql`CREATE SCHEMA public`);
	// Recreate all tables from the drizzle schema definition.
	const { createTables } = await import('./create-tables.js');
	await createTables();
}

export function testConfig() {
	return config;
}