import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

export const APP_ENVS = {
	production: 'production',
	development: 'development',
	testing: 'testing',
} as const;

export type AppEnv = (typeof APP_ENVS)[keyof typeof APP_ENVS];

const DEFAULT_ENV: AppEnv = APP_ENVS.development;
const PORT = 8000;

function requireEnv(name: string, value: string | undefined): string {
	if (value === undefined || value === '') {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function numberFromEnv(name: string, value: string | undefined, fallback: number): number {
	if (value === undefined || value === '') return fallback;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) throw new Error(`Invalid number for ${name}: ${value}`);
	return parsed;
}

function parseAppEnv(raw: string | undefined): AppEnv {
	if (raw === undefined || raw === '') return DEFAULT_ENV;
	if (raw in APP_ENVS) return raw as AppEnv;
	throw new Error(`Invalid NODE_ENV "${raw}"; expected ${Object.values(APP_ENVS).join(', ')}`);
}

const env = parseAppEnv(process.env.NODE_ENV);

const databaseUrl =
	env === APP_ENVS.testing
		? requireEnv('TEST_DATABASE_URL', process.env.TEST_DATABASE_URL)
		: requireEnv('DATABASE_URL', process.env.DATABASE_URL);

export const config = {
	env,
	isProd: env === APP_ENVS.production,
	isDev: env === APP_ENVS.development,
	isTest: env === APP_ENVS.testing,

	port: numberFromEnv('PORT', process.env.PORT, PORT),

	databaseUrl,

	s3: {
		endpointUrl: process.env.S3_ENDPOINT_URL ?? 'http://localhost:9000',
		accessKey: process.env.S3_ACCESS_KEY ?? '',
		secretKey: process.env.S3_SECRET_KEY ?? '',
		bucket: process.env.S3_BUCKET ?? 'chewables',
		region: process.env.S3_REGION ?? 'us-east-1',
	},

	auth: {
		secret: requireEnv('AUTH_SECRET', process.env.AUTH_SECRET),
		session: {
			cookieName: 'chewables.session',
			sameSite: 'lax' as const,
			secure: env === APP_ENVS.production,
			expiresIn: numberFromEnv('SESSION_EXPIRES_IN', process.env.SESSION_EXPIRES_IN, 60 * 60 * 24 * 7),
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
		},
	},

	oauth: {
		redirectBase: process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:5173',
		backendBaseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:8000',
	},

	corsOrigin: env === APP_ENVS.production ? undefined : process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};

export type AppConfig = typeof config;