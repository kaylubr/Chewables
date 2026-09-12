import { Router } from 'express';
import { toNodeHandler } from 'better-auth/node';
import {
	changeEmailHandler,
	changePasswordHandler,
	confirmEmailChangeHandler,
	deleteAccountHandler,
	getMe,
	loginUser,
	registerUser,
	resendVerificationEmail,
	setPasswordHandler,
} from './auth.controller.js';
import { auth } from './better-auth.js';

export const authRoutes = Router();

authRoutes.post('/register', registerUser);
authRoutes.post('/login', loginUser);
authRoutes.get('/me', getMe);
authRoutes.post('/send-verification-email', resendVerificationEmail);

// Account mutations. Each is a thin wrapper that validates, delegates to Better
// Auth, and translates its failures into this API's `{ detail }` contract. They
// must stay declared above the catch-all so they shadow Better Auth's own
// endpoints of the same name.
authRoutes.post('/change-password', changePasswordHandler);
authRoutes.post('/set-password', setPasswordHandler);
authRoutes.post('/change-email', changeEmailHandler);
authRoutes.post('/confirm-email-change', confirmEmailChangeHandler);
authRoutes.post('/delete-account', deleteAccountHandler);

authRoutes.all('*', toNodeHandler(auth));