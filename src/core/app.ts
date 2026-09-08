/**
 * App wiring only: express app creation, middleware, routing, error handling.
 *
 * No endpoint logic lives here — routes delegate to domain controllers.
 * `index.ts` is the only file that starts a listener; importing `app` has no
 * side effects, so tests use it with Supertest directly.
 */
import path from 'node:path';
import express, { type Express } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { auth } from './domains/auth/auth.service.js';
import { authRouter } from './domains/auth/auth.controller.js';
import { photoRoutes } from './domains/photos/photos.controller.js';

export function createApp(): Express {
	const app = express();

	// Global middleware
	app.disable('x-powered-by');
	app.set('trust proxy', 1);
	app.use(express.json({ limit: '1mb' }));

	if (config.corsOrigin) {
		app.use(
			cors({
				origin: config.corsOrigin,
				credentials: true,
			}),
		);
	}

	// Health
	app.get('/api/health', (_req, res) => {
		res.json({ status: 'ok' });
	});

	// Better-Auth owns /api/auth/* (sign-up, sign-in, sign-out, Google OAuth,
	// session). It sets the httpOnly session cookie itself. Our thin /me route
	// is mounted first so it takes precedence over the catch-all handler.
	app.use('/api/auth', authRouter);
	app.all('/api/auth/*', auth.handler);

	// Photo routes are ours; they resolve the user from the session cookie.
	app.use('/api/photos', photoRoutes);

	// Serve the built SvelteKit app for same-origin prod, with SPA fallback.
	if (config.isProd) {
		const staticDir = path.resolve(process.cwd(), '../ui/build');
		app.use(express.static(staticDir));
		app.get('*', (_req, res) => {
			res.sendFile(path.join(staticDir, 'index.html'));
		});
	}

	// Central error handler
	app.use(
		(error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
			console.error(error);
			res.status(500).json({ detail: 'Internal server error' });
		},
	);

	return app;
}

export const app = createApp();