import { createHmac, timingSafeEqual } from 'node:crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { sendNewEmailVerification, sendVerificationEmail } from '../mail/mail.js';
import { deleteStoredObjects, listUserStorageKeys } from '../photos/photos.service.js';
import type {
	AuthResult,
	CreateUserInput,
	SessionUser,
} from '../types/index.js';
import * as AuthRepo from './auth.repo.js';

/**
 * Remembers which address an email change started from, in the browser that
 * requested it. Written when the change is initiated and read when it
 * completes, so "the change finished" can be proven from a signed server-issued
 * value rather than trusted from a query parameter.
 */
const EMAIL_CHANGE_COOKIE = 'chewables.email_change';
/** Matches Better Auth's `emailVerification.expiresIn` default (1 hour). */
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
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
		// Verification is a standalone feature and a prerequisite for
		// social-account linking (see account.accountLinking below), but it
		// does NOT gate password login: unverified users may still sign in
		// with their password and verify later.
		requireEmailVerification: false,
		autoSignIn: true,
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			// Better Auth routes both signup verification and the "confirm your
			// new address" email through this one callback. A change is in
			// flight while the stored row still holds the old address, so a
			// mismatch is what separates the two wordings.
			const row = await AuthRepo.findById(user.id);
			if (row && row.email !== user.email) {
				await sendNewEmailVerification({ to: user.email, verifyUrl: url });
				return;
			}
			await sendVerificationEmail({ to: user.email, verifyUrl: url });
		},
		// Send a verification email at signup so every new account can prove
		// its email before linking social providers.
		sendOnSignUp: true,
		// Better-Auth appends the callbackURL (default: backend `/`) to the
		// verify-email URL. Because the SPA sits on a separate origin in dev,
		// `register` / `loginWithUsername` pass the SPA auth-popup page as the
		// callbackURL so verification lands the user back in the app. See
		// `../ui/static/auth-popup.html`.
		autoSignInAfterVerification: true,
		afterEmailVerification: async (user, request) => {
			// Fires on signup verification too, but only a completed email
			// CHANGE carries the signed "changed from" cookie. When it does and
			// the address has moved on, the recovery identity changed — drop
			// the user's other sessions, keeping the current one alive.
			const from = readEmailChangeCookie(
				request
					? cookieFromHeader(request.headers.get('cookie') ?? undefined, EMAIL_CHANGE_COOKIE)
					: undefined,
			);
			if (!from || from.toLowerCase() === user.email.toLowerCase()) return;
			if (!request) return;
			try {
				await auth.api.revokeOtherSessions({ headers: request.headers });
			} catch (error) {
				// Never fail the verification itself over this; the settings
				// landing page retries the same supported call.
				console.error('[auth] could not revoke other sessions after email change', error);
			}
		},
	},
	user: {
		changeEmail: {
			// Only the new address is verified: `sendChangeEmailConfirmation`
			// (old-address approval) and `updateEmailWithoutVerification` are
			// both deliberately left off.
			enabled: true,
		},
		deleteUser: {
			// In-app confirmation deletes immediately. Without
			// `sendDeleteAccountVerification` Better Auth never emails a link,
			// so no GET that a mail scanner can prefetch deletes an account.
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
		cookiePrefix: "chewables",
		useCrossSubDomainCookies: false,
	},
});

export class EmailTakenError extends Error {
	override name = "EmailTakenError";
}

export class UsernameTakenError extends Error {
	override name = "UsernameTakenError";
}

export class NotAuthenticatedError extends Error {
	override name = "NotAuthenticatedError";
}

export class SameEmailError extends Error {
	override name = "SameEmailError";
}

export class InvalidCurrentPasswordError extends Error {
	override name = "InvalidCurrentPasswordError";
}

export class NoPasswordSetError extends Error {
	override name = "NoPasswordSetError";
}

export class PasswordAlreadySetError extends Error {
	override name = "PasswordAlreadySetError";
}

export class PasswordRequiredError extends Error {
	override name = "PasswordRequiredError";
}

export class UsernameMismatchError extends Error {
	override name = "UsernameMismatchError";
}

export class StaleSessionError extends Error {
	override name = "StaleSessionError";
}

export function applyAuthCookies(
	res: { setHeader(name: string, value: string[]): void } & object,
	result: AuthResult,
): void {
	if (result.setCookies.length > 0) {
		res.setHeader("Set-Cookie", result.setCookies);
	}
}

/** Callback URL for the email-verification link: the SPA auth-popup page. */
function verificationCallbackUrl(next?: string): string {
	const base = config.oauth.redirectBase;
	const target = next?.startsWith("/") ? next : "/profile";
	return `${base}/auth-popup.html?api=${encodeURIComponent(config.oauth.redirectBase)}&verify=1&next=${encodeURIComponent(target)}`;
}

/** Where the email-change confirmation link lands: Settings, not the popup. */
function emailChangeCallbackUrl(): string {
	return `${config.oauth.redirectBase}/settings?email_changed=1`;
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
			callbackURL: verificationCallbackUrl(),
		},
		returnHeaders: true,
	});
	const result = normalizeBetterAuth(raw);
	await AuthRepo.setUsername(result.user.id, input.username);
	return {
		user: {
			id: result.user.id,
			email: result.user.email,
			username: input.username,
			emailVerified: result.user.emailVerified,
			image: result.user.image ?? null,
			createdAt: toIso(result.user.createdAt),
		},
		setCookies: extractSetCookie(result.response?.headers),
	};
}

export async function loginWithUsername(
	username: string,
	password: string,
): Promise<AuthResult | null> {
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
		if (status === "UNAUTHORIZED" || status === "INVALID_EMAIL_OR_PASSWORD") {
			return null;
		}
		throw error;
	}
	const result = normalizeBetterAuth(raw);
	if (!result.token) return null;
	return {
		user: {
			id: user.id,
			email: user.email,
			username: user.username ?? "",
			emailVerified: result.user.emailVerified,
			image: result.user.image ?? null,
			createdAt: toIso(user.createdAt),
		},
		setCookies: extractSetCookie(result.response?.headers),
	};
}

export async function getSessionUser(
	headers: Record<string, string | string[] | undefined>,
): Promise<SessionUser | null> {
	const session = await auth.api.getSession({
		headers: toFetchHeaders(headers),
		// Always resolve from the database. The session cookie cache is signed
		// but not consulted against session rows, so a cached session keeps
		// working after it is revoked — which would silently defeat "revoke
		// other sessions" on a password or email change.
		query: { disableCookieCache: true },
	});
	if (!session) return null;
	return {
		id: session.user.id,
		email: session.user.email,
		username: session.user.name ?? "",
		emailVerified: session.user.emailVerified,
		image: session.user.image ?? null,
		createdAt: toIso(session.user.createdAt),
	};
}

/**
 * Re-send the verification email for the current session's own address, used
 * by the "resend verification email" button.
 *
 * The underlying Better Auth endpoint refuses the request with 400
 * EMAIL_MISMATCH when the requested email differs from the session email. We
 * bypass that check by asking for the session user's email directly no matter
 * what the client sent, so a stale client-side email can't produce a 400.
 */
export async function resendVerificationForSession(
	headers: Record<string, string | string[] | undefined>,
): Promise<boolean> {
	const session = await getSessionUser(headers);
	if (!session) return false;
	await auth.api.sendVerificationEmail({
		body: {
			email: session.email,
			callbackURL: verificationCallbackUrl(),
		},
		headers: toFetchHeaders(headers),
	});
	return true;
}

/**
 * Change the password of an account that already has one.
 *
 * Returns any Set-Cookie headers Better Auth produced: revoking other sessions
 * hands this browser a fresh session cookie, and dropping it would sign the
 * user out of the change they just made.
 */
export async function changePassword(input: {
	headers: Record<string, string | string[] | undefined>;
	currentPassword: string;
	newPassword: string;
}): Promise<string[]> {
	try {
		const raw = await auth.api.changePassword({
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true,
			},
			headers: toFetchHeaders(input.headers),
			returnHeaders: true,
		});
		return cookiesFrom(raw);
	} catch (error) {
		const code = authErrorCode(error);
		if (code === "INVALID_PASSWORD") throw new InvalidCurrentPasswordError();
		if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") throw new NoPasswordSetError();
		throw error;
	}
}

/**
 * Set a password for an account that has none (a social sign-up). Better Auth
 * exposes this server-side only, so the client never calls it directly.
 */
export async function setPassword(input: {
	headers: Record<string, string | string[] | undefined>;
	newPassword: string;
}): Promise<void> {
	try {
		await auth.api.setPassword({
			body: { newPassword: input.newPassword },
			headers: toFetchHeaders(input.headers),
		});
	} catch (error) {
		if (authErrorCode(error) === "PASSWORD_ALREADY_SET") {
			throw new PasswordAlreadySetError();
		}
		throw error;
	}
}

/**
 * Start an email change. The address only moves once the link sent to the new
 * inbox is followed; Better Auth answers with `status: true` even when the
 * address is already taken, so callers must never report "email changed".
 */
export async function changeEmail(input: {
	user: SessionUser;
	headers: Record<string, string | string[] | undefined>;
	newEmail: string;
}): Promise<void> {
	const newEmail = input.newEmail.toLowerCase();
	if (newEmail === input.user.email.toLowerCase()) throw new SameEmailError();
	await auth.api.changeEmail({
		body: {
			newEmail,
			callbackURL: emailChangeCallbackUrl(),
		},
		headers: toFetchHeaders(input.headers),
	});
}

/**
 * Complete an email change on the landing page.
 *
 * Returns true only when this browser started a change (signed cookie present)
 * and the session's address has since moved past it — i.e. the change actually
 * completed. A bare `?email_changed=1` visit changes nothing.
 */
export async function confirmEmailChange(input: {
	headers: Record<string, string | string[] | undefined>;
	cookieHeader: string | undefined;
	user: SessionUser;
}): Promise<boolean> {
	const from = readEmailChangeCookie(cookieFromHeader(input.cookieHeader, EMAIL_CHANGE_COOKIE));
	if (!from || from.toLowerCase() === input.user.email.toLowerCase()) return false;
	await auth.api.revokeOtherSessions({
		headers: toFetchHeaders(input.headers),
	});
	return true;
}

/**
 * Delete the account and everything it owns.
 *
 * Ordering follows ADR 0006 — the row first, then the objects. The photo keys
 * are read while the rows still exist, because deleting the user cascades the
 * photo rows (and therefore the keys) away. Object deletion afterwards is
 * best-effort: the account is already gone, so a failure can only leave an
 * unreachable orphan.
 */
export async function deleteAccount(input: {
	user: SessionUser;
	headers: Record<string, string | string[] | undefined>;
	confirmUsername: string;
	password?: string;
}): Promise<string[]> {
	if (input.confirmUsername !== input.user.username) {
		throw new UsernameMismatchError();
	}

	const hasPassword = await AuthRepo.hasPasswordAccount(input.user.id);
	if (hasPassword && !input.password) throw new PasswordRequiredError();

	const storageKeys = await listUserStorageKeys(input.user.id);

	let setCookies: string[];
	try {
		const raw = await auth.api.deleteUser({
			body: hasPassword ? { password: input.password } : {},
			headers: toFetchHeaders(input.headers),
			returnHeaders: true,
		});
		setCookies = cookiesFrom(raw);
	} catch (error) {
		const code = authErrorCode(error);
		if (code === "INVALID_PASSWORD") throw new InvalidCurrentPasswordError();
		// Better Auth requires a fresh session when there is no password to
		// re-enter (social-only accounts).
		if (code === "SESSION_EXPIRED") throw new StaleSessionError();
		throw error;
	}

	await deleteStoredObjects(storageKeys);
	return setCookies;
}

export function emailChangeCookieName(): string {
	return EMAIL_CHANGE_COOKIE;
}

export function emailChangeCookieValue(email: string): string {
	const value = Buffer.from(email, 'utf8').toString('base64url');
	const mac = createHmac('sha256', config.auth.secret).update(value).digest('base64url');
	return `${value}.${mac}`;
}

export function emailChangeCookieOptions(): {
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	path: string;
	maxAge: number;
} {
	return {
		httpOnly: true,
		sameSite: 'lax',
		secure: config.auth.session.secure,
		path: '/',
		maxAge: EMAIL_CHANGE_TTL_MS,
	};
}

/** Returns the signed address, or null when the value is absent or forged. */
function readEmailChangeCookie(raw: string | undefined): string | null {
	if (!raw) return null;
	const separator = raw.lastIndexOf('.');
	if (separator <= 0) return null;
	const value = raw.slice(0, separator);
	const mac = raw.slice(separator + 1);
	const expected = createHmac('sha256', config.auth.secret).update(value).digest('base64url');
	const given = Buffer.from(mac);
	const wanted = Buffer.from(expected);
	if (given.length !== wanted.length) return null;
	if (!timingSafeEqual(given, wanted)) return null;
	return Buffer.from(value, 'base64url').toString('utf8');
}

function cookieFromHeader(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const separator = part.indexOf('=');
		if (separator === -1) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		return part.slice(separator + 1).trim();
	}
	return undefined;
}

interface BetterAuthResult {
	token: string | null;
	user: {
		id: string;
		email: string;
		name: string;
		emailVerified: boolean;
		image: string | null;
		createdAt: string | Date;
	};
	response?: { headers?: Headers | null };
}

function normalizeBetterAuth(raw: unknown): BetterAuthResult {
	const r = (raw ?? {}) as Record<string, unknown>;
	const inner = (r.response as Record<string, unknown> | undefined) ?? {};
	const user = (r.user ?? inner.user) as BetterAuthResult["user"];
	const token = (r.token ?? inner.token ?? null) as string | null;
	const headers =
		(r.headers as Headers | undefined) ??
		(inner.headers as Headers | undefined);
	return { token, user, response: { headers: headers ?? null } };
}

/** Set-Cookie headers from a Better Auth `{ returnHeaders: true }` result. */
function cookiesFrom(raw: unknown): string[] {
	const r = (raw ?? {}) as Record<string, unknown>;
	const inner = (r.response as Record<string, unknown> | undefined) ?? {};
	const headers =
		(r.headers as Headers | undefined) ??
		(inner.headers as Headers | undefined);
	return extractSetCookie(headers ?? null);
}

/** Better Auth reports failures as an error carrying a machine-readable code. */
function authErrorCode(error: unknown): string | null {
	const body = (error as { body?: { code?: unknown } } | null | undefined)?.body;
	return typeof body?.code === "string" ? body.code : null;
}

function toIso(value: string | Date): string {
	return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

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
	if (typeof headers.getSetCookie === "function") {
		return headers.getSetCookie();
	}
	const value = headers.get("set-cookie");
	if (!value) return [];
	return typeof value === "string" ? [value] : value;
}
