export interface UserModel {
	id: string;
	username: string;
	email: string;
	createdAt: Date;
}

export interface CreateUserInput {
	email: string;
	username: string;
	password: string;
}