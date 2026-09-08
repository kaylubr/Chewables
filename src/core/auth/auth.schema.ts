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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;