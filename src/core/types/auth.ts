export interface SessionUser {
	id: string;
	email: string;
	username: string;
	emailVerified: boolean;
	image: string | null;
}

export interface AuthResult {
	user: SessionUser;
	setCookies: string[];
}
