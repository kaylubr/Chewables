import { pgTable, text, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const photos = pgTable(
	'photos',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		frame: text('frame').notNull(),
		storageKey: text('storageKey').notNull(),
		createdAt: timestamp('createdAt').notNull().defaultNow(),
	},
	(table) => [uniqueIndex('photos_storage_key_unique').on(table.storageKey)],
);

export type Photo = typeof photos.$inferSelect;