/**
 * Client-side auth state.
 *
 * Auth is cookie-session based (Better-Auth): the browser holds the session
 * cookie; the app reads the current user from GET /api/auth/me. No token is
 * stored in localStorage; logout clears the session via the API.
 */
import type { AuthUser } from '@chewable/shared';
import { api } from '../api/client';

class AuthStore {
	user = $state<AuthUser | null>(null);

	get isAuthenticated() {
		return this.user !== null;
	}

	async ensureSession(): Promise<AuthUser | null> {
		this.user = await api.me();
		return this.user;
	}

	setUser(user: AuthUser) {
		this.user = user;
	}

	clear() {
		this.user = null;
	}
}

export const auth = new AuthStore();