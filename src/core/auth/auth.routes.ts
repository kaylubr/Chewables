import { Router } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { registerUser, loginUser, getMe, resendVerificationEmail } from './auth.controller.js';
import { auth } from './auth.service.js';

export const authRoutes = Router();

authRoutes.post('/register', registerUser);
authRoutes.post('/login', loginUser);
authRoutes.get('/me', getMe);
authRoutes.post('/send-verification-email', resendVerificationEmail);
authRoutes.all('*', toNodeHandler(auth));