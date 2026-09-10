/**
 * Backend API client for the SvelteKit frontend.
 *
 * Auth is cookie-session based (Better-Auth): the browser sends the session
 * cookie on every request via `credentials: 'include'`, and the current user
 * is read from GET /api/auth/me. Config/contract types come from the shared
 * `@chewable/shared` package so backend and frontend stay in sync.
 */
import { PUBLIC_API_BASE } from "$env/static/public";
import type { AuthUser, SavedPhoto } from "@chewable/shared";

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	console.log(PUBLIC_API_BASE);
	console.log(path);

	const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
		...init,
		credentials: "include",
		headers: {
			...(init.body instanceof FormData
				? {}
				: { "Content-Type": "application/json" }),
			...init.headers,
		},
	});
	if (!res.ok) {
		let detail = res.statusText;
		try {
			const body = await res.json();
			if (typeof body.detail === "string") detail = body.detail;
		} catch {
			/* keep statusText */
		}
		throw new ApiError(res.status, detail);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export const api = {
	/** Current user from the session cookie, or null when not authenticated. */
	me: async (): Promise<AuthUser | null> => {
		try {
			return await request<AuthUser>("/api/auth/me");
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) return null;
			throw error;
		}
	},
	register: (email: string, username: string, password: string) => {
		// Our register route creates the user with the username handle (ADR
		// 0005) and starts a session via Better-Auth.
		return request<AuthUser>("/api/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, username, password }),
		});
	},
	login: (usernameOrEmail: string, password: string) => {
		// Sign in by username handle (ADR 0005); the backend resolves the
		// username to its account email before delegating to Better-Auth.
		return request<AuthUser>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: usernameOrEmail, password }),
		});
	},
	logout: () => {
		return request<void>("/api/auth/sign-out", { method: "POST" });
	},
	sendVerificationEmail: (email: string, next = "/profile") => {
		// Ask Better-Auth to (re)send the verification email for an existing
		// unverified account. The callbackURL points at the SPA auth-popup page
		// so verification lands the user back in the app after clicking the link.
		const callbackURL = `${location.origin}/auth-popup.html?api=${encodeURIComponent(PUBLIC_API_BASE)}&verify=1&next=${encodeURIComponent(next)}`;
		return request<{ status: boolean }>("/api/auth/send-verification-email", {
			method: "POST",
			body: JSON.stringify({ email, callbackURL }),
		});
	},
	uploadPhoto: (frame: string, blob: Blob) => {
		const form = new FormData();
		form.append("frame", frame);
		form.append("file", blob, `chewables-${frame.toLowerCase()}.webp`);
		return request<SavedPhoto>("/api/photos", {
			method: "POST",
			body: form,
		});
	},
	listPhotos: () =>
		request<SavedPhoto[]>("/api/photos", {
			credentials: "include",
		}),
	photoUrl: (id: string) => request<{ url: string }>(`/api/photos/${id}/url`),
	deletePhoto: (id: string) =>
		request<void>(`/api/photos/${id}`, {
			method: "DELETE",
		}),
};
