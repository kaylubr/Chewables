import request from "supertest";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";
import { storage, StorageError } from "../adapters/storage/storage.js";
import * as mail from "../mail/mail.js";
import { auth } from "./better-auth.js";
import { deleteAccount as deleteAccountService } from "./auth.service.js";
import { StaleSessionError } from "./errors.js";

const PNG_HEADER = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function registerAgent(
	email = "user@example.com",
	username = "user",
): Promise<request.Agent> {
	const agent = request.agent(app);
	await agent.post("/api/auth/register").send({
		email,
		password: "password123",
		username,
	});
	return agent;
}

function upload(agent: request.Agent) {
	return agent
		.post("/api/photos")
		.field("frame", "FILM")
		.attach("file", Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x30)]), {
			filename: "photo.png",
			contentType: "image/png",
		});
}

async function dropCredentialAccount() {
	await db.delete(schema.account).where(eq(schema.account.providerId, "credential"));
}

function tokenFromUrl(url: string): string {
	const token = new URL(url).searchParams.get("token");
	if (!token) throw new Error(`no token in ${url}`);
	return token;
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("settings: /me shape", () => {
	it("reports createdAt and hasPassword for a password account", async () => {
		const agent = await registerAgent();
		const resp = await agent.get("/api/auth/me");
		expect(resp.status).toBe(200);
		expect(resp.body.hasPassword).toBe(true);
		expect(Number.isNaN(Date.parse(resp.body.createdAt))).toBe(false);
	});

	it("reports hasPassword=false for an account with no credential", async () => {
		const agent = await registerAgent();
		await dropCredentialAccount();
		const resp = await agent.get("/api/auth/me");
		expect(resp.status).toBe(200);
		expect(resp.body.hasPassword).toBe(false);
	});

	it("includes hasPassword in register and login responses", async () => {
		const registered = await request(app).post("/api/auth/register").send({
			email: "shape@example.com",
			password: "password123",
			username: "shapeuser",
		});
		expect(registered.body.user.hasPassword).toBe(true);
		expect(registered.body.user.createdAt).toBeTruthy();

		const loggedIn = await request(app).post("/api/auth/login").send({
			username: "shapeuser",
			password: "password123",
		});
		expect(loggedIn.body.user.hasPassword).toBe(true);
	});
});

describe("change password", () => {
	it("rejects a wrong current password", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/change-password").send({
			currentPassword: "not-the-password",
			newPassword: "new-password-123",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("Current password is incorrect");
	});

	it("rejects an unauthenticated request", async () => {
		const resp = await request(app).post("/api/auth/change-password").send({
			currentPassword: "password123",
			newPassword: "new-password-123",
		});
		expect(resp.status).toBe(401);
	});

	it("changes the password and keeps the current session signed in", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/change-password").send({
			currentPassword: "password123",
			newPassword: "new-password-123",
		});
		expect(resp.status).toBe(200);

		expect((await agent.get("/api/auth/me")).status).toBe(200);
		const login = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "new-password-123",
		});
		expect(login.status).toBe(200);
		const oldLogin = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});
		expect(oldLogin.status).toBe(401);
	});

	it("revokes other sessions", async () => {
		const first = await registerAgent();
		const second = request.agent(app);
		await second.post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});
		expect((await second.get("/api/auth/me")).status).toBe(200);

		const resp = await first.post("/api/auth/change-password").send({
			currentPassword: "password123",
			newPassword: "new-password-123",
		});
		expect(resp.status).toBe(200);

		expect((await first.get("/api/auth/me")).status).toBe(200);
		expect((await second.get("/api/auth/me")).status).toBe(401);
	});

	it("tells an account without a password to set one instead", async () => {
		const agent = await registerAgent();
		await dropCredentialAccount();
		const resp = await agent.post("/api/auth/change-password").send({
			currentPassword: "password123",
			newPassword: "new-password-123",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("This account has no password yet");
	});

	it("rejects a new password shorter than the minimum", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/change-password").send({
			currentPassword: "password123",
			newPassword: "short",
		});
		expect(resp.status).toBe(422);
	});
});

describe("set password", () => {
	it("creates a credential account for a social-only user", async () => {
		const agent = await registerAgent();
		await dropCredentialAccount();
		expect((await agent.get("/api/auth/me")).body.hasPassword).toBe(false);

		const resp = await agent.post("/api/auth/set-password").send({
			newPassword: "brand-new-123",
		});
		expect(resp.status).toBe(200);
		expect((await agent.get("/api/auth/me")).body.hasPassword).toBe(true);

		const login = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "brand-new-123",
		});
		expect(login.status).toBe(200);
	});

	it("refuses when the account already has a password", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/set-password").send({
			newPassword: "brand-new-123",
		});
		expect(resp.status).toBe(409);
		expect(resp.body.detail).toBe("This account already has a password");
	});

	it("rejects an unauthenticated request", async () => {
		const resp = await request(app).post("/api/auth/set-password").send({
			newPassword: "brand-new-123",
		});
		expect(resp.status).toBe(401);
	});
});

describe("change email", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("sends the confirmation to the new address with change wording", async () => {
		const agent = await registerAgent();
		let newEmailUrl = "";
		const newSpy = vi
			.spyOn(mail, "sendNewEmailVerification")
			.mockImplementation(async ({ verifyUrl }) => {
				newEmailUrl = verifyUrl;
			});
		const verifySpy = vi
			.spyOn(mail, "sendVerificationEmail")
			.mockImplementation(async () => undefined);

		const resp = await agent.post("/api/auth/change-email").send({
			newEmail: "moved@example.com",
		});
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);
		expect(newSpy).toHaveBeenCalledTimes(1);
		expect(verifySpy).not.toHaveBeenCalled();
		expect(tokenFromUrl(newEmailUrl)).toBeTruthy();

		expect((await agent.get("/api/auth/me")).body.email).toBe("user@example.com");
	});

	it("remembers where the change started", async () => {
		const agent = await registerAgent();
		vi.spyOn(mail, "sendNewEmailVerification").mockImplementation(async () => undefined);
		const resp = await agent.post("/api/auth/change-email").send({
			newEmail: "moved@example.com",
		});
		const cookies = resp.headers["set-cookie"];
		const joined = Array.isArray(cookies) ? cookies.join(";") : (cookies ?? "");
		expect(joined).toContain("chewables.email_change");
	});

	it("moves the address once the link is followed", async () => {
		const agent = await registerAgent();
		let url = "";
		vi.spyOn(mail, "sendNewEmailVerification").mockImplementation(async ({ verifyUrl }) => {
			url = verifyUrl;
		});

		await agent.post("/api/auth/change-email").send({ newEmail: "moved@example.com" });
		const verified = await agent.get(
			`/api/auth/verify-email?token=${encodeURIComponent(tokenFromUrl(url))}`,
		);
		expect(verified.status).toBe(200);

		const me = await agent.get("/api/auth/me");
		expect(me.body.email).toBe("moved@example.com");
		expect(me.body.emailVerified).toBe(true);
	});

	it("still answers success for an address that is already taken", async () => {
		const agent = await registerAgent();
		await registerAgent("taken@example.com", "otheruser");
		const newSpy = vi
			.spyOn(mail, "sendNewEmailVerification")
			.mockImplementation(async () => undefined);

		const resp = await agent.post("/api/auth/change-email").send({
			newEmail: "taken@example.com",
		});
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);
		expect(newSpy).not.toHaveBeenCalled();
		expect((await agent.get("/api/auth/me")).body.email).toBe("user@example.com");
	});

	it("rejects the address the account already uses", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/change-email").send({
			newEmail: "user@example.com",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("That is already your email address");
	});

	it("rejects an invalid address", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/change-email").send({
			newEmail: "not-an-email",
		});
		expect(resp.status).toBe(422);
	});

	it("rejects an unauthenticated request", async () => {
		const resp = await request(app)
			.post("/api/auth/change-email")
			.send({ newEmail: "moved@example.com" });
		expect(resp.status).toBe(401);
	});
});

describe("confirm email change", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("revokes other sessions once the change has completed", async () => {
		const agent = await registerAgent();
		const other = request.agent(app);
		await other.post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});

		let url = "";
		vi.spyOn(mail, "sendNewEmailVerification").mockImplementation(async ({ verifyUrl }) => {
			url = verifyUrl;
		});
		await agent.post("/api/auth/change-email").send({ newEmail: "moved@example.com" });
		await agent.get(`/api/auth/verify-email?token=${encodeURIComponent(tokenFromUrl(url))}`);

		const resp = await agent.post("/api/auth/confirm-email-change").send({});
		expect(resp.status).toBe(200);
		expect(resp.body.changed).toBe(true);
		expect((await agent.get("/api/auth/me")).status).toBe(200);
		expect((await other.get("/api/auth/me")).status).toBe(401);
	});

	it("does not revoke anything for a bare visit without a change in flight", async () => {
		const agent = await registerAgent();
		const other = request.agent(app);
		await other.post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});

		const resp = await agent.post("/api/auth/confirm-email-change").send({});
		expect(resp.status).toBe(200);
		expect(resp.body.changed).toBe(false);
		expect((await other.get("/api/auth/me")).status).toBe(200);
	});

	it("does not revoke anything when the change was only started", async () => {
		const agent = await registerAgent();
		vi.spyOn(mail, "sendNewEmailVerification").mockImplementation(async () => undefined);
		await agent.post("/api/auth/change-email").send({ newEmail: "moved@example.com" });

		const resp = await agent.post("/api/auth/confirm-email-change").send({});
		expect(resp.body.changed).toBe(false);
	});

	it("rejects an unauthenticated request", async () => {
		const resp = await request(app).post("/api/auth/confirm-email-change").send({});
		expect(resp.status).toBe(401);
	});
});

describe("delete account", () => {
	it("requires the typed username to match", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/delete-account").send({
			username: "someone-else",
			password: "password123",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("That username does not match");
		expect(await db.select().from(schema.users)).toHaveLength(1);
	});

	it("requires the password for an account that has one", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/delete-account").send({
			username: "user",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("Enter your password to delete this account");
	});

	it("rejects a wrong password", async () => {
		const agent = await registerAgent();
		const resp = await agent.post("/api/auth/delete-account").send({
			username: "user",
			password: "wrong-password",
		});
		expect(resp.status).toBe(400);
		expect(resp.body.detail).toBe("Password is incorrect");
		expect(await db.select().from(schema.users)).toHaveLength(1);
	});

	it("rejects an unauthenticated request", async () => {
		const resp = await request(app).post("/api/auth/delete-account").send({
			username: "user",
			password: "password123",
		});
		expect(resp.status).toBe(401);
	});

	it("deletes the user, their photos, and their stored objects", async () => {
		const agent = await registerAgent();
		const photo = await upload(agent);
		expect(photo.status).toBe(201);
		const storageKey = photo.body.storageKey as string;
		expect(await db.select().from(schema.photos)).toHaveLength(1);

		const deleteSpy = vi.spyOn(storage, "delete");

		const resp = await agent.post("/api/auth/delete-account").send({
			username: "user",
			password: "password123",
		});
		expect(resp.status).toBe(200);

		expect(await db.select().from(schema.users)).toHaveLength(0);
		expect(await db.select().from(schema.photos)).toHaveLength(0);
		expect(await db.select().from(schema.session)).toHaveLength(0);
		expect(deleteSpy).toHaveBeenCalledWith(storageKey);

		expect((await agent.get("/api/auth/me")).status).toBe(401);
		await expect(
			request(app).post("/api/auth/login").send({
				username: "user",
				password: "password123",
			}),
		).resolves.toMatchObject({ status: 401 });
	});

	it("tolerates a storage failure after the account is gone", async () => {
		const agent = await registerAgent();
		await upload(agent);

		vi.spyOn(storage, "delete").mockRejectedValue(
			new StorageError("simulated outage"),
		);

		const resp = await agent.post("/api/auth/delete-account").send({
			username: "user",
			password: "password123",
		});
		expect(resp.status).toBe(200);
		expect(await db.select().from(schema.users)).toHaveLength(0);
		expect(await db.select().from(schema.photos)).toHaveLength(0);
	});

	it("deletes a passwordless account without a password", async () => {
		const agent = await registerAgent();
		await dropCredentialAccount();
		const resp = await agent.post("/api/auth/delete-account").send({
			username: "user",
		});
		expect(resp.status).toBe(200);
		expect(await db.select().from(schema.users)).toHaveLength(0);
	});

	it("asks for a fresh sign-in when the session is stale", async () => {
		const user = {
			id: "someone",
			email: "someone@example.com",
			username: "someone",
			emailVerified: true,
			image: null,
			createdAt: new Date().toISOString(),
		};
		vi.spyOn(auth.api, "deleteUser").mockRejectedValue(
			APIError.from("BAD_REQUEST", { message: "expired", code: "SESSION_EXPIRED" }),
		);
		await expect(
			deleteAccountService({
				user,
				headers: {},
				confirmUsername: "someone",
			}),
		).rejects.toBeInstanceOf(StaleSessionError);
	});
});
