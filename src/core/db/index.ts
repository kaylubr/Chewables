import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import { users } from './users.js';
import { photos } from './photos.js';
import { sessions } from './sessions.js';
import { accounts } from './accounts.js';
import { verifications } from './verifications.js';

export const db = drizzle({
	connection: config.databaseUrl,
	schema: { users, photos, session: sessions, account: accounts, verification: verifications },
});

export const schema = {
	users,
	photos,
	session: sessions,
	account: accounts,
	verification: verifications,
};

export { users, photos, sessions, accounts, verifications };
export type { User } from './users.js';
export type { Photo } from './photos.js';
export type { SessionTable } from './sessions.js';
export type { Account } from './accounts.js';
export type { Verification } from './verifications.js';