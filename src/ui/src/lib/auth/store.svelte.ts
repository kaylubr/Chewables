import type { AuthUser } from "@chewable/shared";
import { api } from "../api/client";

class AuthStore {
	user = $state<AuthUser | null>(null);

	get isAuthenticated() {
		return this.user !== null;
	}

	get verificationPending() {
		return this.user !== null && !this.user.emailVerified;
	}

	sendVerificationEmail() {
		if (!this.user) return;
		return api.sendVerificationEmail(this.user.email);
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
