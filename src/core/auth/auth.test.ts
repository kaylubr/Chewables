import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";
import * as mail from "../mail/mail.js";

async function registerUser(
	res: request.Agent | request.SuperTest<request.Test>,
	email = "user@example.com",
	username = "user",
) {
	return res.post("/api/auth/register").send({
		email,
		password: "password123",
		username,
	});
}

describe("auth endpoints", () => {
	it("registers a user and returns a token + user", async () => {
		const resp = await registerUser(request(app));
		expect(resp.status).toBe(201);
		expect(resp.body.token_type).toBe("bearer");
		expect(resp.body.user.email).toBe("user@example.com");
		expect(resp.body.user.username).toBe("user");
	});

	it("returns emailVerified=false for a freshly registered user", async () => {
		const resp = await registerUser(request(app));
		expect(resp.status).toBe(201);
		expect(resp.body.user.emailVerified).toBe(false);
	});

	it("still allows password login before email verification", async () => {
		await registerUser(request(app));
		const resp = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});
		expect(resp.status).toBe(200);
		expect(resp.body.user.emailVerified).toBe(false);
	});

	it("re-sends a verification email for an unverified account", async () => {
		await registerUser(request(app));
		const resp = await request(app)
			.post("/api/auth/send-verification-email")
			.send({ email: "user@example.com" });
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);
	});

	it("re-sends a verification email with a logged-in session (frontend flow)", async () => {
		// Reproduces the exact request the browser sends from the photos page:
		// an AUTOMATICALLY-SIGNED-IN register session cookie is attached, plus
		// a raw callbackURL pointing at the SPA auth-popup page.
		const agent = request.agent(app);
		await agent.post("/api/auth/register").send({
			email: "resend-session@example.com",
			password: "password123",
			username: "resenduser",
		});

		const callbackURL =
			"http://localhost:5173/auth-popup.html?api=http%3A%2F%2Flocalhost%3A8000&verify=1&next=%2Fphotos";

		const resp = await agent
			.post("/api/auth/send-verification-email")
			.send({ email: "resend-session@example.com", callbackURL });

		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);
	});

	it("resends to the session email even when the request body carries a mismatched email", async () => {
		// Regression guard: Better Auth's own endpoint returns 400 EMAIL_MISMATCH
		// when a logged-in session posts a different email. Our wrapper routes the
		// resend to the session user's own address, so a stale client email can
		// never produce a 400.
		const agent = request.agent(app);
		await agent.post("/api/auth/register").send({
			email: "session-owner@example.com",
			password: "password123",
			username: "sessionowner",
		});

		const resp = await agent
			.post("/api/auth/send-verification-email")
			.send({ email: "someone-else@example.com" });

		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);
	});

	it("does not store the password in plaintext", async () => {
		await registerUser(request(app));
		const users = await db.select().from(schema.users);
		expect(users).toHaveLength(1);
		const accounts = await db.select().from(schema.account);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.password).toBeTruthy();
		expect(accounts[0]?.password).not.toBe("password123");
	});

	it("rejects duplicate email registration", async () => {
		const r = request(app);
		await registerUser(r);
		const second = await r.post("/api/auth/register").send({
			email: "user@example.com",
			password: "password123",
			username: "otheruser",
		});
		expect(second.status).toBe(409);
	});

	it("rejects duplicate username registration", async () => {
		const r = request(app);
		await registerUser(r);
		const second = await r.post("/api/auth/register").send({
			email: "other@example.com",
			password: "password123",
			username: "user",
		});
		expect(second.status).toBe(409);
	});

	it("rejects username with bad characters", async () => {
		for (const bad of ["has space", "has/slash", "UPPER", "", "ab"]) {
			const resp = await request(app).post("/api/auth/register").send({
				email: "bad@example.com",
				password: "password123",
				username: bad,
			});
			expect(resp.status).toBe(422);
		}
	});

	it("logs in successfully with username", async () => {
		await registerUser(request(app));
		const resp = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "password123",
		});
		expect(resp.status).toBe(200);
		expect(resp.body.user.username).toBe("user");
	});

	it("fails login with invalid password", async () => {
		await registerUser(request(app));
		const resp = await request(app).post("/api/auth/login").send({
			username: "user",
			password: "wrong-password",
		});
		expect(resp.status).toBe(401);
	});

	it("blocks unauthenticated /me", async () => {
		const resp = await request(app).get("/api/auth/me");
		expect(resp.status).toBe(401);
	});

	it("rejects invalid token", async () => {
		const resp = await request(app)
			.get("/api/auth/me")
			.set("Authorization", "Bearer not-a-real-token");
		expect(resp.status).toBe(401);
	});

	it("returns the registered user via /me with session cookie", async () => {
		const agent = request.agent(app);
		await agent.post("/api/auth/register").send({
			email: "me@example.com",
			password: "password123",
			username: "meuser",
		});
		const resp = await agent.get("/api/auth/me");
		expect(resp.status).toBe(200);
		expect(resp.body.email).toBe("me@example.com");
		expect(resp.body.username).toBe("meuser");
	});

	it("rejects short password", async () => {
		const resp = await request(app).post("/api/auth/register").send({
			email: "short@example.com",
			password: "short",
			username: "shortuser",
		});
		expect(resp.status).toBe(422);
	});

	it("rejects invalid email", async () => {
		const resp = await request(app).post("/api/auth/register").send({
			email: "not-an-email",
			password: "password123",
			username: "bademail",
		});
		expect(resp.status).toBe(422);
	});

	it("rejects missing username", async () => {
		const resp = await request(app).post("/api/auth/register").send({
			email: "nouser@example.com",
			password: "password123",
		});
		expect(resp.status).toBe(422);
	});

	it("verifies the email via the token endpoint and flips emailVerified", async () => {
		// Capture the token Better-Auth generates for the verification email.
		let verifyUrl = "";
		const sendSpy = vi
			.spyOn(mail, "sendVerificationEmail")
			.mockImplementation(async ({ verifyUrl: url }) => {
				verifyUrl = url;
			});

		const agent = request.agent(app);
		await agent.post("/api/auth/register").send({
			email: "verify-me@example.com",
			password: "password123",
			username: "verifyuser",
		});

		expect(verifyUrl).toContain("/api/auth/verify-email?token=");
		const token = new URL(verifyUrl).searchParams.get("token");
		expect(token).toBeTruthy();

		const resp = await agent.get(
			`/api/auth/verify-email?token=${encodeURIComponent(token ?? "")}`,
		);
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe(true);

		const me = await agent.get("/api/auth/me");
		expect(me.status).toBe(200);
		expect(me.body.emailVerified).toBe(true);

		sendSpy.mockRestore();
	});
});
