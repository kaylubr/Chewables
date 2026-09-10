import { Resend } from "resend";
import { config } from "../config.js";

const resend = config.mail.apiKey ? new Resend(config.mail.apiKey) : null;

export interface VerificationEmail {
	to: string;
	verifyUrl: string;
}

/**
 * Send the email-verification email for a newly registered address.
 *
 * In dev/test (no RESEND_API_KEY configured) this falls back to logging the
 * verification link so the full flow is exercisable without a mail provider.
 *
 * The Resend call is deliberately fire-and-forget: awaiting a network call here
 * would let an attacker time the sign-up/send-verification responses to
 * enumerate valid accounts. The rejection is caught so a mail failure can never
 * become an unhandled promise rejection. This relies on the process staying
 * alive after the response is sent (Docker/PM2/systemd).
 */
export async function sendVerificationEmail({
	to,
	verifyUrl,
}: VerificationEmail): Promise<void> {
	if (!resend) {
		console.info(
			`[mail] no RESEND_API_KEY configured; verification link for ${to}: ${verifyUrl}`,
		);
		return;
	}
	void resend.emails
		.send({
			from: config.mail.from,
			to,
			subject: "Verify your email — Chewables",
			html: [
				"<p>Thanks for creating an account with Chewables.</p>",
				"<p>Please confirm your email address to finish signing up (this also lets",
				" Google sign-in link to your account automatically).</p>",
				`<p><a href="${verifyUrl}">Verify my email</a></p>`,
			].join("\n"),
		})
		.catch((err) => {
			console.error(`[mail] failed to send verification email to ${to}`, err);
		});
}
