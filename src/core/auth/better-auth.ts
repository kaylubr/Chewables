import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { sendNewEmailVerification, sendVerificationEmail } from '../mail/mail.js';
import * as AuthRepo from './auth.repo.js';
import { readEmailChangeCookie } from './email-change-cookie.js';

/**
 * The Better-Auth adapter.
 *
 * Holds the engine's configuration plus the helpers that turn its return
 * shapes and error codes into this app's own types, so the account operations
 * in `auth.service.ts` deal only in domain concepts.
 */
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
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const row = await AuthRepo.findById(user.id);
			if (row && row.email !== user.email) {
				await sendNewEmailVerification({ to: user.email, verifyUrl: url });
				return;
			}
			await sendVerificationEmail({ to: user.email, verifyUrl: url });
		},
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		afterEmailVerification: async (user, request) => {
			const from = readEmailChangeCookie(request?.headers.get('cookie') ?? undefined);
			if (!from || from.toLowerCase() === user.email.toLowerCase()) return;
			if (!request) return;
			try {
				await auth.api.revokeOtherSessions({ headers: request.headers });
			} catch (error) {
				console.error('[auth] could not revoke other sessions after email change', error);
			}
		},
	},
	user: {
		changeEmail: {
			enabled: true,
		},
		deleteUser: {
			enabled: true,
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			requireLocalEmailVerified: true,
		},
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

/** The user shape Better-Auth returns, before it becomes a `SessionUser`. */
export interface BetterAuthUser {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: string | Date;
}

export interface BetterAuthSignIn {
	token: string | null;
	user: BetterAuthUser;
	setCookies: string[];
}

/**
 * Normalize a `{ returnHeaders: true }` sign-up/sign-in result into the user,
 * the session token, and the cookies to hand back to the browser.
 */
export function normalizeSignIn(raw: unknown): BetterAuthSignIn {
	const outer = (raw ?? {}) as Record<string, unknown>;
	const inner = (outer.response as Record<string, unknown> | undefined) ?? {};
	const user = (outer.user ?? inner.user) as BetterAuthUser;
	const token = (outer.token ?? inner.token ?? null) as string | null;
	return { token, user, setCookies: extractSetCookie(headersOf(outer, inner)) };
}

/** Set-Cookie headers from any `{ returnHeaders: true }` result. */
export function setCookiesFrom(raw: unknown): string[] {
	const outer = (raw ?? {}) as Record<string, unknown>;
	const inner = (outer.response as Record<string, unknown> | undefined) ?? {};
	return extractSetCookie(headersOf(outer, inner));
}

/** Better Auth reports failures as an error carrying a machine-readable code. */
export function authErrorCode(error: unknown): string | null {
	const body = (error as { body?: { code?: unknown } } | null | undefined)?.body;
	return typeof body?.code === 'string' ? body.code : null;
}

export function toFetchHeaders(headers: Record<string, string | string[] | undefined>): Headers {
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

function headersOf(outer: Record<string, unknown>, inner: Record<string, unknown>): Headers | null {
	return (outer.headers as Headers | undefined) ?? (inner.headers as Headers | undefined) ?? null;
}

function extractSetCookie(headers: Headers | null): string[] {
	if (!headers) return [];
	if (typeof headers.getSetCookie === 'function') {
		return headers.getSetCookie();
	}
	const value = headers.get('set-cookie');
	if (!value) return [];
	return typeof value === 'string' ? [value] : value;
}
