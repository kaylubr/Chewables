import type { RequestHandler } from 'express';
import { registerSchema, loginSchema } from './auth.schema.js';
import { applyAuthCookies, EmailTakenError, UsernameTakenError, getSessionUser, loginWithUsername, register, resendVerificationForSession } from './auth.service.js';

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export const registerUser: RequestHandler = async (req, res, next) => {
	const parsed = registerSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(422).json({ detail: 'Invalid request' });
	}
	try {
		const result = await register(parsed.data);
		applyAuthCookies(res, result);
		return res.status(201).json({ token_type: 'bearer', access_token: null, user: result.user });
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
		return res.status(200).json({ token_type: 'bearer', access_token: null, user: result.user });
	} catch (error) {
		next(error);
	}
};

export const getMe: RequestHandler = async (req, res) => {
	const user = await getSessionUser(req.headers);
	if (!user) {
		return res.status(401).json({ detail: 'Not authenticated' });
	}
	return res.json(user);
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