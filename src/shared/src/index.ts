export interface AuthUser {
	id: string;
	email: string;
	username: string;
}

export interface TokenResponse {
	token_type: 'bearer';
	access_token: string | null;
	user: AuthUser;
}

export interface SavedPhoto {
	id: string;
	frame: string;
	storageKey: string;
	createdAt: string;
}

export const FRAME_IDS = ['VINTAGE', 'POLAROID', 'FILM', 'CLASSIC'] as const;
export type FrameId = (typeof FRAME_IDS)[number];
export type FrameCategory = 'film';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];