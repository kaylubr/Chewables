import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const COOKIE_NAME = 'chewables.email_change';
const TTL_MS = 60 * 60 * 1000;

export function emailChangeCookieName(): string {
	return COOKIE_NAME;
}

export function emailChangeCookieValue(email: string): string {
	const value = Buffer.from(email, 'utf8').toString('base64url');
	const mac = createHmac('sha256', config.auth.secret).update(value).digest('base64url');
	return `${value}.${mac}`;
}

export function emailChangeCookieOptions(): {
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	path: string;
	maxAge: number;
} {
	return {
		httpOnly: true,
		sameSite: 'lax',
		secure: config.auth.session.secure,
		path: '/',
		maxAge: TTL_MS,
	};
}

export function readEmailChangeCookie(cookieHeader: string | undefined): string | null {
	const raw = cookieValue(cookieHeader, COOKIE_NAME);
	if (!raw) return null;
	const separator = raw.lastIndexOf('.');
	if (separator <= 0) return null;
	const value = raw.slice(0, separator);
	const mac = raw.slice(separator + 1);
	const expected = createHmac('sha256', config.auth.secret).update(value).digest('base64url');
	const given = Buffer.from(mac);
	const wanted = Buffer.from(expected);
	if (given.length !== wanted.length) return null;
	if (!timingSafeEqual(given, wanted)) return null;
	return Buffer.from(value, 'base64url').toString('utf8');
}

function cookieValue(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const separator = part.indexOf('=');
		if (separator === -1) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		return part.slice(separator + 1).trim();
	}
	return undefined;
}
