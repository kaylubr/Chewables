/**
 * Backend API client for the SvelteKit frontend.
 *
 * Auth is cookie-session based (Better-Auth): the browser sends the session
 * cookie on every request via `credentials: 'include'`, and the current user
 * is read from GET /api/auth/me. Config/contract types come from the shared
 * `@chewable/shared` package so backend and frontend stay in sync.
 */
import { PUBLIC_API_BASE } from '$env/static/public';
import type { AuthUser, SavedPhoto } from '@chewable/shared';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
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

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

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
		// Better-Auth sign-up endpoint; it sets the session cookie itself.
		return request<AuthUser>("/api/auth/sign-up/email", {
			method: "POST",
			body: JSON.stringify({ email, password, name: username }),
		});
	},
	login: (usernameOrEmail: string, password: string) => {
		// Sign in by the username handle (ADR 0005). The backend resolves the
		// username to its account email before delegating to Better-Auth.
		if (USERNAME_PATTERN.test(usernameOrEmail)) {
			return request<AuthUser>("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({ username: usernameOrEmail, password }),
			});
		}
		return request<AuthUser>("/api/auth/sign-in/email", {
			method: "POST",
			body: JSON.stringify({ email: usernameOrEmail, password }),
		});
	},
	logout: () => {
		return request<void>("/api/auth/sign-out", { method: "POST" });
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
	photoUrl: (id: string) =>
		request<{ url: string }>(`/api/photos/${id}/url`),
	deletePhoto: (id: string) =>
		request<void>(`/api/photos/${id}`, {
			method: "DELETE",
		}),
};