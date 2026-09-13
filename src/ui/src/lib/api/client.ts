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
		}
		throw new ApiError(res.status, detail);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export const api = {
	me: async (): Promise<AuthUser | null> => {
		try {
			return await request<AuthUser>("/api/auth/me");
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) return null;
			throw error;
		}
	},
	register: (email: string, username: string, password: string) => {
		return request<AuthUser>("/api/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, username, password }),
		});
	},
	login: (usernameOrEmail: string, password: string) => {
		return request<AuthUser>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: usernameOrEmail, password }),
		});
	},
	logout: () => {
		return request<void>("/api/auth/sign-out", { method: "POST" });
	},
	sendVerificationEmail: (email: string, next = "/profile") => {
		const callbackURL = `${location.origin}/auth-popup.html?api=${encodeURIComponent(PUBLIC_API_BASE)}&verify=1&next=${encodeURIComponent(next)}`;
		return request<{ status: boolean }>("/api/auth/send-verification-email", {
			method: "POST",
			body: JSON.stringify({ email, callbackURL }),
		});
	},
	changePassword: (currentPassword: string, newPassword: string) =>
		request<{ status: boolean }>("/api/auth/change-password", {
			method: "POST",
			body: JSON.stringify({ currentPassword, newPassword }),
		}),
	setPassword: (newPassword: string) =>
		request<{ status: boolean }>("/api/auth/set-password", {
			method: "POST",
			body: JSON.stringify({ newPassword }),
		}),
	changeEmail: (newEmail: string) =>
		request<{ status: boolean }>("/api/auth/change-email", {
			method: "POST",
			body: JSON.stringify({ newEmail }),
		}),
	confirmEmailChange: () =>
		request<{ changed: boolean }>("/api/auth/confirm-email-change", {
			method: "POST",
			body: JSON.stringify({}),
		}),
	deleteAccount: (username: string, password?: string) =>
		request<{ status: boolean }>("/api/auth/delete-account", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		}),
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
