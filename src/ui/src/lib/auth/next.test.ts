import { describe, expect, it } from 'vitest';
import { safeNext } from './next';

describe('safeNext', () => {
	it('keeps a same-origin path', () => {
		expect(safeNext('/photos')).toBe('/photos');
		expect(safeNext('/photobooth/frame?x=1')).toBe('/photobooth/frame?x=1');
	});

	it('falls back when there is no value', () => {
		expect(safeNext(null)).toBe('/profile');
		expect(safeNext(undefined)).toBe('/profile');
		expect(safeNext('')).toBe('/profile');
	});

	it('rejects an absolute URL and the protocol-relative form', () => {
		expect(safeNext('https://evil.example')).toBe('/profile');
		expect(safeNext('//evil.example')).toBe('/profile');
	});

	it('honours a custom fallback', () => {
		expect(safeNext('https://evil.example', '/')).toBe('/');
	});
});
