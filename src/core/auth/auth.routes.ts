import { Router } from 'express';
import { registerUser, loginUser, getMe } from './auth.controller.js';
import { auth } from './auth.service.js';

export const authRoutes = Router();

authRoutes.post('/register', registerUser);
authRoutes.post('/login', loginUser);
authRoutes.get('/me', getMe);
// Everything else under /api/auth/* (Google OAuth, sign-out, session) is
// handled by Better-Auth's own middleware, mounted in app.ts.
authRoutes.all('*', auth.handler);