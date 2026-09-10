export interface SessionUser {
	id: string;
	email: string;
	username: string;
	emailVerified: boolean;
	image: string | null;
	/** ISO timestamp of when the account was created. */
	createdAt: string;
}

export interface AuthResult {
	user: SessionUser;
	setCookies: string[];
}
