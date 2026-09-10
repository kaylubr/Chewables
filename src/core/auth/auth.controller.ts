import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import {
	changeEmailSchema,
	changePasswordSchema,
	deleteAccountSchema,
	loginSchema,
	registerSchema,
	setPasswordSchema,
} from './auth.schema.js';
import {
	applyAuthCookies,
	changeEmail,
	changePassword,
	confirmEmailChange,
	deleteAccount,
	EmailTakenError,
	emailChangeCookieName,
	emailChangeCookieOptions,
	emailChangeCookieValue,
	getSessionUser,
	InvalidCurrentPasswordError,
	loginWithUsername,
	NoPasswordSetError,
	PasswordAlreadySetError,
	PasswordRequiredError,
	register,
	resendVerificationForSession,
	SameEmailError,
	setPassword,
	StaleSessionError,
	UsernameTakenError,
	UsernameMismatchError,
} from './auth.service.js';
import * as AuthRepo from './auth.repo.js';

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export const registerUser: RequestHandler = async (req, res, next) => {
	const parsed = registerSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Invalid request' });
	}
	try {
		const result = await register(parsed.data);
		applyAuthCookies(res, result);
		return res.status(201).json({
			token_type: 'bearer',
			access_token: null,
			user: { ...result.user, hasPassword: true },
		});
	} catch (error) {
		if (error instanceof EmailTakenError || error instanceof UsernameTakenError) {
			return res.status(409).json({ detail: 'An account with that email/username already exists' });
		}
		next(error);
	}
};

export const loginUser: RequestHandler = async (req, res, next) => {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success || !USERNAME_PATTERN.test(parsed.data.username)) {
		return res.status(422).json({ detail: 'Invalid credentials' });
	}
	try {
		const result = await loginWithUsername(parsed.data.username, parsed.data.password);
		if (!result) {
			return res.status(401).json({ detail: 'Incorrect username or password' });
		}
		applyAuthCookies(res, result);
		// Signing in with a password implies a credential account exists.
		return res.status(200).json({
			token_type: 'bearer',
			access_token: null,
			user: { ...result.user, hasPassword: true },
		});
	} catch (error) {
		next(error);
	}
};

export const getMe: RequestHandler = async (req, res) => {
	const user = await getSessionUser(req.headers);
	if (!user) {
		return res.status(401).json({ detail: 'Not authenticated' });
	}
	// Computed here rather than in getSessionUser: that helper backs every
	// authenticated request, and this only needs answering for the account page.
	return res.json({ ...user, hasPassword: await AuthRepo.hasPasswordAccount(user.id) });
};

export const resendVerificationEmail: RequestHandler = async (req, res, next) => {
	try {
		const sent = await resendVerificationForSession(req.headers);
		if (!sent) {
			// No session — fall through to Better Auth's built-in endpoint,
			// which handles the unauthenticated case (and hides registration /
			// email enumeration via a timing floor) for a plain email request.
			return next();
		}
		return res.status(200).json({ status: true });
	} catch (error) {
		next(error);
	}
};

/** The authenticated session user, or null after replying 401. */
async function requireSession(req: Request, res: Response) {
	const user = await getSessionUser(req.headers);
	if (!user) {
		res.status(401).json({ detail: 'Not authenticated' });
		return null;
	}
	return user;
}

export const changePasswordHandler: RequestHandler = async (req, res, next) => {
	const parsed = changePasswordSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Invalid request' });
	}
	const user = await requireSession(req, res);
	if (!user) return;
	try {
		const setCookies = await changePassword({
			headers: req.headers,
			currentPassword: parsed.data.currentPassword,
			newPassword: parsed.data.newPassword,
		});
		// Revoking other sessions reissues this browser's session cookie.
		if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
		return res.status(200).json({ status: true });
	} catch (error) {
		if (error instanceof InvalidCurrentPasswordError) {
			return res.status(400).json({ detail: 'Current password is incorrect' });
		}
		if (error instanceof NoPasswordSetError) {
			return res.status(400).json({ detail: 'This account has no password yet' });
		}
		next(error);
	}
};

export const setPasswordHandler: RequestHandler = async (req, res, next) => {
	const parsed = setPasswordSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Password must be at least 8 characters' });
	}
	const user = await requireSession(req, res);
	if (!user) return;
	try {
		await setPassword({
			headers: req.headers,
			newPassword: parsed.data.newPassword,
		});
		return res.status(200).json({ status: true });
	} catch (error) {
		if (error instanceof PasswordAlreadySetError) {
			return res.status(409).json({ detail: 'This account already has a password' });
		}
		next(error);
	}
};

export const changeEmailHandler: RequestHandler = async (req, res, next) => {
	const parsed = changeEmailSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Enter a valid email address' });
	}
	const user = await requireSession(req, res);
	if (!user) return;
	try {
		await changeEmail({
			user,
			headers: req.headers,
			newEmail: parsed.data.newEmail,
		});
		// Remember where this change started so completion can be proven later.
		res.cookie(
			emailChangeCookieName(),
			emailChangeCookieValue(user.email),
			emailChangeCookieOptions(),
		);
		// Better Auth answers success even when the address is taken, so the
		// response never claims the email actually changed.
		return res.status(200).json({ status: true });
	} catch (error) {
		if (error instanceof SameEmailError) {
			return res.status(400).json({ detail: 'That is already your email address' });
		}
		next(error);
	}
};

export const confirmEmailChangeHandler: RequestHandler = async (req, res, next) => {
	const user = await requireSession(req, res);
	if (!user) return;
	try {
		const changed = await confirmEmailChange({
			headers: req.headers,
			cookieHeader: req.headers.cookie,
			user,
		});
		res.clearCookie(emailChangeCookieName(), { path: '/' });
		return res.json({ changed });
	} catch (error) {
		next(error);
	}
};

export const deleteAccountHandler: RequestHandler = async (req, res, next) => {
	const parsed = deleteAccountSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Invalid request' });
	}
	const user = await requireSession(req, res);
	if (!user) return;
	try {
		const setCookies = await deleteAccount({
			user,
			headers: req.headers,
			confirmUsername: parsed.data.username,
			password: parsed.data.password,
		});
		if (setCookies.length > 0) {
			res.setHeader('Set-Cookie', setCookies);
		} else {
			// Better Auth clears its own session cookie when it can; make sure
			// the browser is signed out either way.
			res.clearCookie(config.auth.session.cookieName, { path: '/' });
		}
		return res.status(200).json({ status: true });
	} catch (error) {
		if (error instanceof UsernameMismatchError) {
			return res.status(400).json({ detail: 'That username does not match' });
		}
		if (error instanceof PasswordRequiredError) {
			return res.status(400).json({ detail: 'Enter your password to delete this account' });
		}
		if (error instanceof InvalidCurrentPasswordError) {
			return res.status(400).json({ detail: 'Password is incorrect' });
		}
		if (error instanceof StaleSessionError) {
			return res.status(401).json({ detail: 'Sign in again to confirm deletion' });
		}
		next(error);
	}
};