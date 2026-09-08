/**
 * Creates all tables from the drizzle schema by executing DDL directly.
 * Used by tests to reset the schema per run without the drizzle-kit CLI.
 * Column names deliberately mirror the drizzle schema (camelCase + Better
 * Auth's canonical shape) so the adapter matches.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/schema.js';

const DDL: string[] = [
	`CREATE TABLE IF NOT EXISTS "user" (
		"id" text PRIMARY KEY,
		"name" text NOT NULL,
		"email" text NOT NULL,
		"emailVerified" boolean NOT NULL DEFAULT false,
		"image" text,
		"username" text,
		"createdAt" timestamp NOT NULL DEFAULT now(),
		"updatedAt" timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS user_username_unique ON "user" ("username")`,
	`CREATE TABLE IF NOT EXISTS session (
		"id" text PRIMARY KEY,
		"token" text NOT NULL,
		"user_id" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		"expiresAt" timestamp with time zone NOT NULL,
		"ipAddress" text,
		"userAgent" text,
		"createdAt" timestamp NOT NULL DEFAULT now(),
		"updatedAt" timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS account (
		"id" text PRIMARY KEY,
		"user_id" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		"accountId" text NOT NULL,
		"providerId" text NOT NULL,
		"password" text,
		"refreshToken" text,
		"accessToken" text,
		"accessTokenExpiresAt" timestamp with time zone,
		"refreshTokenExpiresAt" timestamp with time zone,
		"scope" text,
		"idToken" text,
		"createdAt" timestamp NOT NULL DEFAULT now(),
		"updatedAt" timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS account_user_id_idx ON account ("user_id")`,
	`CREATE TABLE IF NOT EXISTS verification (
		"id" text PRIMARY KEY,
		"identifier" text NOT NULL,
		"value" text NOT NULL,
		"expiresAt" timestamp with time zone NOT NULL,
		"createdAt" timestamp NOT NULL DEFAULT now(),
		"updatedAt" timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS photos (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		"user_id" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		"frame" text NOT NULL,
		"storageKey" text NOT NULL,
		"createdAt" timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS photos_storage_key_unique ON photos ("storageKey")`,
];

export async function createTables(): Promise<void> {
	for (const ddl of DDL) {
		await db.execute(sql.raw(`${ddl};`));
	}
}