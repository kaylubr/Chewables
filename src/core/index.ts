import app from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
	console.log(`Listening to PORT: ${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		server.close(() => process.exit(0));
	});
}