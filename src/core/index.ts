/**
 * Bootstrap only: create the app, start the listener.
 *
 * Kept separate from app.ts so tests can import the app without binding a port.
 */
import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
	console.log(`Chewables API listening on http://localhost:${config.port} (${config.env})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		server.close(() => process.exit(0));
	});
}