import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db, schema } from '../db/index.js';
import { config } from '../config.js';
import type { AuthResult, CreateUserInput, SessionUser } from '../types/index.js';
import * as AuthRepo from './auth.repo.js';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.users,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	secret: config.auth.secret,
	baseURL: config.oauth.backendBaseUrl,
	trustedOrigins: config.corsOrigin ? [config.corsOrigin] : [],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		autoSignIn: true,
	},
	socialProviders: {
		google: {
			clientId: config.auth.google.clientId,
			clientSecret: config.auth.google.clientSecret,
			redirectURI: `${config.oauth.backendBaseUrl}/api/auth/callback/google`,
		},
	},
	session: {
		expiresIn: config.auth.session.expiresIn,
		cookieCache: {
			enabled: true,
			maxAge: config.auth.session.expiresIn,
		},
	},
	cookies: {
		session_token: {
			name: config.auth.session.cookieName,
			sameSite: config.auth.session.sameSite,
			secure: config.auth.session.secure,
		},
	},
	advanced: {
		cookiePrefix: 'chewables',
		useCrossSubDomainCookies: false,
	},
});

export class EmailTakenError extends Error {
	override name = 'EmailTakenError';
}

export class UsernameTakenError extends Error {
	override name = 'UsernameTakenError';
}

export function applyAuthCookies(
	res: { setHeader(name: string, value: string[]): void } & object,
	result: AuthResult,
): void {
	if (result.setCookies.length > 0) {
		res.setHeader('Set-Cookie', result.setCookies);
	}
}

export async function register(input: CreateUserInput): Promise<AuthResult> {
	const [emailTaken, usernameTaken] = await Promise.all([
		AuthRepo.findByEmail(input.email),
		AuthRepo.findByUsername(input.username),
	]);
	if (emailTaken) throw new EmailTakenError();
	if (usernameTaken) throw new UsernameTakenError();

	const raw = await auth.api.signUpEmail({
		body: {
			email: input.email,
			password: input.password,
			name: input.username,
		},
		returnHeaders: true,
	});
	const result = normalizeBetterAuth(raw);
	await AuthRepo.setUsername(result.user.id, input.username);
	return {
		user: { id: result.user.id, email: result.user.email, username: input.username },
		setCookies: extractSetCookie(result.response?.headers),
	};
}

export async function loginWithUsername(username: string, password: string): Promise<AuthResult | null> {
	const user = await AuthRepo.findByUsername(username);
	if (!user) return null;
	let raw: unknown;
	try {
		raw = await auth.api.signInEmail({
			body: { email: user.email, password },
			returnHeaders: true,
		});
	} catch (error) {
		const status = (error as { status?: string }).status;
		if (status === 'UNAUTHORIZED' || status === 'INVALID_EMAIL_OR_PASSWORD') {
			return null;
		}
		throw error;
	}
	const result = normalizeBetterAuth(raw);
	if (!result.token) return null;
	return {
		user: { id: user.id, email: user.email, username: user.username ?? '' },
		setCookies: extractSetCookie(result.response?.headers),
	};
}

export async function getSessionUser(
	headers: Record<string, string | string[] | undefined>,
): Promise<SessionUser | null> {
	const session = await auth.api.getSession({ headers: toFetchHeaders(headers) });
	if (!session) return null;
	return {
		id: session.user.id,
		email: session.user.email,
		username: session.user.name ?? '',
	};
}

interface BetterAuthResult {
	token: string | null;
	user: { id: string; email: string; name: string };
	response?: { headers?: Headers | null };
}

function normalizeBetterAuth(raw: unknown): BetterAuthResult {
	const r = (raw ?? {}) as Record<string, unknown>;
	const inner = (r.response as Record<string, unknown> | undefined) ?? {};
	const user = (r.user ?? inner.user) as BetterAuthResult['user'];
	const token = (r.token ?? inner.token ?? null) as string | null;
	const headers = (r.headers as Headers | undefined) ?? (inner.headers as Headers | undefined);
	return { token, user, response: { headers: headers ?? null } };
}

function toFetchHeaders(headers: Record<string, string | string[] | undefined>): Headers {
	const h = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const v of value) h.append(key, v);
		} else {
			h.set(key, value);
		}
	}
	return h;
}

function extractSetCookie(headers?: Headers | null): string[] {
	if (!headers) return [];
	if (typeof headers.getSetCookie === 'function') {
		return headers.getSetCookie();
	}
	const value = headers.get('set-cookie');
	if (!value) return [];
	return typeof value === 'string' ? [value] : value;
}