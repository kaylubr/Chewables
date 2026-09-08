import { pgTable, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: boolean('emailVerified').notNull().default(false),
		image: text('image'),
		username: text('username'),
		createdAt: timestamp('createdAt').notNull().defaultNow(),
		updatedAt: timestamp('updatedAt').notNull().defaultNow(),
	},
	(table) => [uniqueIndex('user_username_unique').on(table.username)],
);

export type User = typeof users.$inferSelect;