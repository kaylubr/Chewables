/**
 * Better-Auth instance + configuration, plus service helpers that bridge the
 * username-based login contract (ADR 0005) to Better-Auth's email-based
 * sign-in, and propagate the session cookie to the Express response.
 *
 * Sessions are cookie-based (httpOnly, signed). The cookie's security flags
 * are environment-driven via config.auth.session. Google OAuth is handled by
 * Better-Auth's Google plugin; account linking follows ADR 0008's resolution
 * order (identity → verified-email match → new user).
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db, schema } from '../../db/schema.js';
import { config } from '../../config.js';
import * as authRepo from './auth.repo.js';

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

export interface AuthResult {
	user: { id: string; email: string; username: string };
	/** Set-Cookie header values (session cookie) to apply to the response. */
	setCookies: string[];
}

/** Copy Better-Auth's response Set-Cookie headers onto an Express response. */
export function applyAuthCookies(
	res: { setHeader(name: string, value: string[]): void } & object,
	result: AuthResult,
): void {
	if (result.setCookies.length > 0) {
		res.setHeader('Set-Cookie', result.setCookies);
	}
}

interface BetterAuthResult {
	token: string | null;
	user: { id: string; email: string; name: string };
	response?: { headers?: Headers | null };
}

/** Normalize Better-Auth's sign-up/sign-in return into a stable shape. */
function normalizeBetterAuth(raw: unknown): BetterAuthResult {
	const r = (raw ?? {}) as Record<string, unknown>;
	const inner = (r.response as Record<string, unknown> | undefined) ?? {};
	const user = (r.user ?? inner.user) as BetterAuthResult['user'];
	const token = (r.token ?? inner.token ?? null) as string | null;
	// Better-Auth puts the Set-Cookie header on the top-level `headers` of the
	// returned object when returnHeaders is set.
	const headers = (r.headers as Headers | undefined) ?? (inner.headers as Headers | undefined);
	return { token, user, response: { headers: headers ?? null } };
}

/**
 * Register a password account. Returns the created user plus the session
 * cookie Better-Auth issued, so the controller can propagate it.
 */
export async function register(input: {
	email: string;
	username: string;
	password: string;
}): Promise<AuthResult> {
	// Pre-check handles so we can return a 409 before Better-Auth touches the
	// DB (it keys on email, not our username).
	const [emailTaken, usernameTaken] = await Promise.all([
		authRepo.findByEmail(input.email),
		authRepo.findByUsername(input.username),
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
	// Better-Auth doesn't know about our `username` handle, so stamp it in
	// after the user row is created (ADR 0005).
	await authRepo.setUsername(result.user.id, input.username);
	return {
		user: { id: result.user.id, email: result.user.email, username: input.username },
		setCookies: extractSetCookie(result.response?.headers),
	};
}

export class EmailTakenError extends Error {
	override name = 'EmailTakenError';
}

export class UsernameTakenError extends Error {
	override name = 'UsernameTakenError';
}

/**
 * Login by username (ADR 0005: username is the login handle). Resolves the
 * username to its account email, then lets Better-Auth validate the password
 * and start a session. Returns the user + session cookie, or null on failure.
 */
export async function loginWithUsername(
	username: string,
	password: string,
): Promise<AuthResult | null> {
	const user = await authRepo.findByUsername(username);
	if (!user) return null;
	let raw: unknown;
	try {
		raw = await auth.api.signInEmail({
			body: { email: user.email, password },
			returnHeaders: true,
		});
	} catch (error) {
		// Better-Auth throws on an invalid email/password; surface as a failed
		// login rather than a 500.
		const status = (error as { status?: string }).status;
		if (status === 'UNAUTHORIZED' || status === 'INVALID_EMAIL_OR_PASSWORD') {
			return null;
		}
		throw error;
	}
	const result = normalizeBetterAuth(raw);
	if (!result.token) return null;
	return {
		user: authRepo.toAuthUser(user),
		setCookies: extractSetCookie(result.response?.headers),
	};
}

/** Current session user from an incoming request's headers/cookies. */
export async function getSessionUser(
	headers: Record<string, string | string[] | undefined>,
): Promise<{ id: string; email: string; username: string } | null> {
	const session = await auth.api.getSession({ headers: toFetchHeaders(headers) });
	if (!session) return null;
	return {
		id: session.user.id,
		email: session.user.email,
		username: session.user.name ?? '',
	};
}

/** Convert Node-style request headers to a fetch Headers for Better-Auth. */
function toFetchHeaders(
	headers: Record<string, string | string[] | undefined>,
): Headers {
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