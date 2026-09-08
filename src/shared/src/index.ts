/**
 * Shared contract types between the Express backend and the SvelteKit
 * frontend. Import these from both sides so wire shapes stay in sync.
 */

/** A $state-detail application user account. */
export interface AuthUser {
	id: string;
	/** Email is stored lowercase and unique. */
	email: string;
	/** The login handle for password accounts; social users get one generated. */
	username: string;
}

/** Response from register/login; the frontend now relies on the session cookie. */
export interface TokenResponse {
	// Retained for compatibility; auth is cookie-session based, so clients
	// should read the session via /api/auth/me instead of storing a bearer token.
	accessToken: string;
	tokenType: 'bearer';
	user: AuthUser;
}

/** A saved-photo metadata row returned to the client. */
export interface SavedPhoto {
	id: string;
	frame: string;
	storageKey: string;
	createdAt: string;
}

/** Fixed frame vocabulary shared with the frontend (see src/lib/frames). */
export const FRAME_IDS = ['VINTAGE', 'POLAROID', 'FILM', 'CLASSIC'] as const;
export type FrameId = (typeof FRAME_IDS)[number];
export type FrameCategory = 'film';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];