import { eq, or } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

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
	return rows[0] ? toUserRow(rows[0]) : null;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
	const rows = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
	const rows = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

export async function findByUsernameOrEmail(identifier: string): Promise<UserRow | null> {
	const rows = await db
		.select()
		.from(schema.users)
		.where(or(eq(schema.users.username, identifier), eq(schema.users.email, identifier.toLowerCase())))
		.limit(1);
	return rows[0] ? toUserRow(rows[0]) : null;
}

function toUserRow(row: typeof schema.users.$inferSelect): UserRow {
	return {
		id: row.id,
		username: row.username ?? '',
		email: row.email,
		createdAt: row.createdAt,
	};
}