export interface SessionUser {
	id: string;
	email: string;
	username: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: string;
}

export interface AuthResult {
	user: SessionUser;
	setCookies: string[];
}
