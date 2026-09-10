export interface SessionUser {
	id: string;
	email: string;
	username: string;
	emailVerified: boolean;
}

export interface AuthResult {
	user: SessionUser;
	setCookies: string[];
}
