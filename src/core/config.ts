/**
 * Centralized environment configuration.
 *
 * This is the only module allowed to read process.env. Every other file
 * imports the typed `config` object below. Values are read once at import
 * time; required vars throw on a missing/invalid value rather than
 * allowing a misconfigured server to boot.
 */
import dotenv from 'dotenv';
dotenv.config();

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
const databaseUrl = requireEnv('DATABASE_URL', process.env.DATABASE_URL);

export const config = {
	env,
	isProd: env === APP_ENVS.production,
	isDev: env === APP_ENVS.development,
	isTest: env === APP_ENVS.testing,

	port: numberFromEnv('PORT', process.env.PORT, PORT),

	databaseUrl,

	/** Object-storage (S3-compatible) settings — MinIO in local dev. */
	s3: {
		endpointUrl: process.env.S3_ENDPOINT_URL ?? 'http://localhost:9000',
		accessKey: process.env.S3_ACCESS_KEY ?? '',
		secretKey: process.env.S3_SECRET_KEY ?? '',
		bucket: process.env.S3_BUCKET ?? 'chewables',
		region: process.env.S3_REGION ?? 'us-east-1',
	},

	/**
	 * Auth settings. Sessions are managed by Better-Auth via an httpOnly,
	 * signed cookie. The cookie's security flags are environment-driven:
	 * dev runs on plain HTTP across origins (SPA on 5173, API on 8000), so
	 * secure is off and CORS allows the dev origin; prod is same-origin over
	 * TLS, so secure is on and no cross-origin CORS is needed.
	 */
	auth: {
		secret: requireEnv('AUTH_SECRET', process.env.AUTH_SECRET),
		session: {
			cookieName: 'chewables.session',
			sameSite: 'lax' as const,
			secure: env === APP_ENVS.production,
			// 7 days by default, matching the previous JWT expiry default.
			expiresIn: numberFromEnv('SESSION_EXPIRES_IN', process.env.SESSION_EXPIRES_IN, 60 * 60 * 24 * 7),
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
		},
	},

	/** OAuth redirect destinations. Better-Auth handles the callback itself. */
	oauth: {
		redirectBase: process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:5173',
		backendBaseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:8000',
	},

	/** CORS origin(s): dev allows the Vite dev server; prod is same-origin. */
	corsOrigin: env === APP_ENVS.production ? undefined : process.env.CORS_ORIGIN ?? 'http://localhost:5173',
} as const;

export type AppConfig = typeof config;