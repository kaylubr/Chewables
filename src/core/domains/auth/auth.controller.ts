/**
 * Auth HTTP layer: thin route handlers that validate input, call services,
 * propagate the session cookie, and shape responses. No DB or storage
 * internals here. Google OAuth + sign-out go through Better-Auth's native
 * handler (mounted in app.ts); /me is a convenience for the SPA.
 */
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { applyAuthCookies, EmailTakenError, UsernameTakenError, getSessionUser, loginWithUsername, register } from './auth.service.js';

export const authRouter = Router({ mergeParams: true });

const registerSchema = z.object({
	email: z.string().email(),
	username: z
		.string()
		.min(3)
		.max(32)
		.regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscores only'),
	password: z.string().min(8).max(128),
});

const loginSchema = z.object({
	username: z.string().min(3).max(32),
	password: z.string(),
});

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

/** POST /api/auth/register — create an account and start a session. */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
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
});

/** POST /api/auth/login — authenticate by username and start a session. */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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
});

/** GET /api/auth/me — the current session's user, else 401. */
authRouter.get('/me', async (req, res) => {
	const user = await getSessionUser(req.headers);
	if (!user) {
		return res.status(401).json({ detail: 'Not authenticated' });
	}
	return res.json(user);
});