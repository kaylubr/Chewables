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

authRoutes.post('/change-password', changePasswordHandler);
authRoutes.post('/set-password', setPasswordHandler);
authRoutes.post('/change-email', changeEmailHandler);
authRoutes.post('/confirm-email-change', confirmEmailChangeHandler);
authRoutes.post('/delete-account', deleteAccountHandler);

authRoutes.all('*', toNodeHandler(auth));