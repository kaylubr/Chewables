import { z } from 'zod';

export const registerSchema = z.object({
	email: z.string().email(),
	username: z
		.string()
		.min(3)
		.max(32)
		.regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscores only'),
	password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
	username: z.string().min(3).max(32),
	password: z.string(),
});

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: z.string().min(8).max(128),
});

export const setPasswordSchema = z.object({
	newPassword: z.string().min(8).max(128),
});

export const changeEmailSchema = z.object({
	newEmail: z.string().email(),
});

export const deleteAccountSchema = z.object({
	username: z.string().min(3).max(32),
	password: z.string().min(1).max(128).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;