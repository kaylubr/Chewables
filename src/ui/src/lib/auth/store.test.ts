import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./store.svelte";

const U1 = {
	id: "u1",
	email: "a@b.com",
	username: "alice",
	emailVerified: true,
	image: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	hasPassword: true,
};
const U2 = {
	id: "u2",
	email: "persist@b.com",
	username: "bob",
	emailVerified: true,
	image: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	hasPassword: true,
};

describe("auth store", () => {
	beforeEach(() => {
		auth.clear();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts unauthenticated", () => {
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.user).toBeNull();
	});

	it("setUser makes the user authenticated", () => {
		auth.setUser(U1);
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.user?.email).toBe("a@b.com");
		expect(auth.user?.username).toBe("alice");
	});

	it("clear signs the user out", () => {
		auth.setUser(U1);
		auth.clear();
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.user).toBeNull();
	});

	it("swapping to a new user replaces the previous ones", () => {
		auth.setUser(U1);
		auth.setUser(U2);
		expect(auth.user?.username).toBe("bob");
		expect(auth.isAuthenticated).toBe(true);
	});
});
