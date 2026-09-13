export class EmailTakenError extends Error {
	override name = 'EmailTakenError';
}

export class UsernameTakenError extends Error {
	override name = 'UsernameTakenError';
}

export class SameEmailError extends Error {
	override name = 'SameEmailError';
}

export class InvalidCurrentPasswordError extends Error {
	override name = 'InvalidCurrentPasswordError';
}

export class NoPasswordSetError extends Error {
	override name = 'NoPasswordSetError';
}

export class PasswordAlreadySetError extends Error {
	override name = 'PasswordAlreadySetError';
}

export class PasswordRequiredError extends Error {
	override name = 'PasswordRequiredError';
}

export class UsernameMismatchError extends Error {
	override name = 'UsernameMismatchError';
}

export class StaleSessionError extends Error {
	override name = 'StaleSessionError';
}
