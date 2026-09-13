export function safeNext(value: string | null | undefined, fallback = '/profile'): string {
	if (!value) return fallback;
	if (!value.startsWith('/') || value.startsWith('//')) return fallback;
	return value;
}
