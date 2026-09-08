/**
 * Drizzle schema. Two kinds of tables live here:
 *
 * 1. Better-Auth's canonical auth tables (`user`, `session`, `account`,
 *    `verification`) with the exact column names Better-Auth expects. We add
 *    a `username` column to `user` to keep the ADR 0005 login handle; Better
 *    Auth ignores columns it never writes.
 * 2. App-owned tables (`photos`) mirroring the previous SQLAlchemy models.
 *
 * Users exist only so a signed-in user can permanently save finished photos;
 * guests never touch these rows.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { config } from '../config.js';

/**
 * Better-Auth user table. Column names match Better-Auth's schema exactly
 * (name, email, emailVerified, image, updatedAt) plus our `username` handle.
 */
export const users = pgTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: boolean('emailVerified').notNull().default(false),
		image: text('image'),
		// Product handle (ADR 0005). Nullable so Better-Auth can create a user
		// without it; our auth service sets it right after sign-up/Google login.
		username: text('username'),
		createdAt: timestamp('createdAt').notNull().defaultNow(),
		updatedAt: timestamp('updatedAt').notNull().defaultNow(),
	},
	(table) => [uniqueIndex('user_username_unique').on(table.username)],
);

export const sessionTable = pgTable('session', {
	id: text('id').primaryKey(),
	token: text('token').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
	updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const accountTable = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: text('accountId').notNull(),
		providerId: text('providerId').notNull(),
		password: text('password'),
		refreshToken: text('refreshToken'),
		accessToken: text('accessToken'),
		accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
		scope: text('scope'),
		idToken: text('idToken'),
		createdAt: timestamp('createdAt').notNull().defaultNow(),
		updatedAt: timestamp('updatedAt').notNull().defaultNow(),
	},
	(table) => [index('account_user_id_idx').on(table.userId)],
);

export const verificationTable = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
	updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const photos = pgTable(
	'photos',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// Fixed frontend-owned identifier vocabulary; validated on write.
		frame: text('frame').notNull(),
		// Server-generated path, e.g. user/{userId}/photos/{photoId}.webp.
		storageKey: text('storageKey').notNull(),
		createdAt: timestamp('createdAt').notNull().defaultNow(),
	},
	(table) => [uniqueIndex('photos_storage_key_unique').on(table.storageKey)],
);

/** Drizzle client bound to the app database. */
export const db = drizzle({
	connection: config.databaseUrl,
	schema: {
		users,
		session: sessionTable,
		account: accountTable,
		verification: verificationTable,
		photos,
	},
});

export const schema = {
	users,
	session: sessionTable,
	account: accountTable,
	verification: verificationTable,
	photos,
};