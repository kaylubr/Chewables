/**
 * Data access for the auth domain. Thin Drizzle queries — no business rules.
 * Credentials live in Better-Auth's `account` table; this repo only reads the
 * `user` table for the username<->email mapping used by login.
 */
import { eq, or } from 'drizzle-orm';
import { db, schema } from '../../db/schema.js';
import type { AuthUser } from '@chewable/shared';

export interface UserRow {
	id: string;
	username: string | null;
	email: string;
	createdAt: Date;
}

export async function setUsername(id: string, username: string): Promise<void> {
	await db.update(schema.users).set({ username }).where(eq(schema.users.id, id));
}

export async function findById(id: string): Promise<UserRow | null> {
	const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
	const row = rows[0];
	return row ? toUserRow(row) : null;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
	const normalized = email.toLowerCase();
	const rows = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, normalized))
		.limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
	const rows = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.username, username))
		.limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

export async function findByUsernameOrEmail(identifier: string): Promise<UserRow | null> {
	const lower = identifier.toLowerCase();
	const rows = await db
		.select()
		.from(schema.users)
		.where(or(eq(schema.users.username, identifier), eq(schema.users.email, lower)))
		.limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

function toUserRow(row: (typeof schema.users.$inferSelect)): UserRow {
	return {
		id: row.id,
		username: row.username,
		email: row.email,
		createdAt: row.createdAt,
	};
}

export function toAuthUser(row: UserRow): AuthUser {
	return {
		id: row.id,
		email: row.email,
		username: row.username ?? '',
	};
}