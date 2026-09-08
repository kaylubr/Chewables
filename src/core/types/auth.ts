export interface SessionUser {
	id: string;
	email: string;
	username: string;
}

export interface AuthResult {
	user: SessionUser;
	setCookies: string[];
}