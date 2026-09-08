import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const accounts = pgTable(
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

export type Account = typeof accounts.$inferSelect;