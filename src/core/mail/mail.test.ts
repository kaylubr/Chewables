import { describe, expect, it, vi } from "vitest";
import { config } from "../config.js";
import {
	isUndeliverable,
	sendNewEmailVerification,
	sendVerificationEmail,
} from "./mail.js";

const { send } = vi.hoisted(() => ({
	send: vi.fn(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock("resend", () => ({
	Resend: class {
		emails = { send };
	},
}));

describe("mail", () => {
	it("runs with mail sending suppressed", () => {
		expect(config.isTest).toBe(true);
	});

	it("does not reach Resend for a verification email", async () => {
		await sendVerificationEmail({
			to: "someone@example.com",
			verifyUrl: "https://example.test/verify?token=abc",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("does not reach Resend for an email-change confirmation", async () => {
		await sendNewEmailVerification({
			to: "moved@example.com",
			verifyUrl: "https://example.test/verify?token=def",
		});
		expect(send).not.toHaveBeenCalled();
	});
});

describe("undeliverable addresses", () => {
	it("flags the reserved domains Resend refuses", () => {
		expect(isUndeliverable("someone@example.com")).toBe(true);
		expect(isUndeliverable("someone@mail.example.com")).toBe(true);
		expect(isUndeliverable("someone@example.org")).toBe(true);
		expect(isUndeliverable("someone@foo.test")).toBe(true);
		expect(isUndeliverable("someone@bar.invalid")).toBe(true);
		expect(isUndeliverable("someone@localhost")).toBe(true);
	});

	it("allows a deliverable address", () => {
		expect(isUndeliverable("someone@gmail.com")).toBe(false);
		expect(isUndeliverable("someone@notexample.com")).toBe(false);
		expect(isUndeliverable("someone@example.company")).toBe(false);
	});
});
