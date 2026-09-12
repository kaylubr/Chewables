/**
 * Resolve the post-authentication destination from a `?next=` query value.
 *
 * Only a same-origin path counts: anything else — including the
 * protocol-relative `//host` form — falls back, so a crafted link cannot bounce
 * a signed-in user off-site.
 */
export function safeNext(value: string | null | undefined, fallback = '/profile'): string {
	if (!value) return fallback;
	if (!value.startsWith('/') || value.startsWith('//')) return fallback;
	return value;
}
