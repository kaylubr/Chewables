import { Router } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { registerUser, loginUser, getMe } from './auth.controller.js';
import { auth } from './auth.service.js';

export const authRoutes = Router();

authRoutes.post('/register', registerUser);
authRoutes.post('/login', loginUser);
authRoutes.get('/me', getMe);
authRoutes.all('*', toNodeHandler(auth));