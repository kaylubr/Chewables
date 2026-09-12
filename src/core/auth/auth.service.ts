import { config } from '../config.js';
import { deleteStoredObjects, listUserStorageKeys } from '../photos/photos.service.js';
import type { AuthResult, CreateUserInput, SessionUser } from '../types/index.js';
import * as AuthRepo from './auth.repo.js';
import {
	auth,
	authErrorCode,
	normalizeSignIn,
	setCookiesFrom,
	toFetchHeaders,
} from './better-auth.js';
import { readEmailChangeCookie } from './email-change-cookie.js';
import {
	EmailTakenError,
	InvalidCurrentPasswordError,
	NoPasswordSetError,
	PasswordAlreadySetError,
	PasswordRequiredError,
	SameEmailError,
	StaleSessionError,
	UsernameMismatchError,
	UsernameTakenError,
} from './errors.js';

/** Callback URL for the email-verification link: the SPA auth-popup page. */
function verificationCallbackUrl(next?: string): string {
	const base = config.oauth.redirectBase;
	const target = next?.startsWith('/') ? next : '/profile';
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
	const result = normalizeSignIn(raw);
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
		setCookies: result.setCookies,
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
		if (status === 'UNAUTHORIZED' || status === 'INVALID_EMAIL_OR_PASSWORD') {
			return null;
		}
		throw error;
	}
	const result = normalizeSignIn(raw);
	if (!result.token) return null;
	return {
		user: {
			id: user.id,
			email: user.email,
			username: user.username ?? '',
			emailVerified: result.user.emailVerified,
			image: result.user.image ?? null,
			createdAt: toIso(user.createdAt),
		},
		setCookies: result.setCookies,
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
		username: session.user.name ?? '',
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
		return setCookiesFrom(raw);
	} catch (error) {
		const code = authErrorCode(error);
		if (code === 'INVALID_PASSWORD') throw new InvalidCurrentPasswordError();
		if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') throw new NoPasswordSetError();
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
		if (authErrorCode(error) === 'PASSWORD_ALREADY_SET') {
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
	const from = readEmailChangeCookie(input.cookieHeader);
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
		setCookies = setCookiesFrom(raw);
	} catch (error) {
		const code = authErrorCode(error);
		if (code === 'INVALID_PASSWORD') throw new InvalidCurrentPasswordError();
		// Better Auth requires a fresh session when there is no password to
		// re-enter (social-only accounts).
		if (code === 'SESSION_EXPIRED') throw new StaleSessionError();
		throw error;
	}

	await deleteStoredObjects(storageKeys);
	return setCookies;
}

function toIso(value: string | Date): string {
	return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString();
}
