import { Resend } from "resend";
import { config } from "../config.js";

const resend = config.mail.apiKey ? new Resend(config.mail.apiKey) : null;

interface MailMessage {
	to: string;
	subject: string;
	html: string;
	/** Logged instead of sent when no provider is configured, so the flow stays testable. */
	link: string;
}

/**
 * Send one transactional email.
 *
 * In dev/test (no RESEND_API_KEY configured) this falls back to logging the
 * link so the full flow is exercisable without a mail provider.
 *
 * The Resend call is deliberately fire-and-forget: awaiting a network call here
 * would let an attacker time the sign-up/send-verification responses to
 * enumerate valid accounts. The rejection is caught so a mail failure can never
 * become an unhandled promise rejection. This relies on the process staying
 * alive after the response is sent (Docker/PM2/systemd).
 */
async function sendMail({ to, subject, html, link }: MailMessage): Promise<void> {
	if (!resend) {
		console.info(
			`[mail] no RESEND_API_KEY configured; "${subject}" for ${to}: ${link}`,
		);
		return;
	}
	void resend.emails
		.send({
			from: config.mail.from,
			to,
			subject,
			html,
		})
		.catch((err) => {
			console.error(`[mail] failed to send "${subject}" to ${to}`, err);
		});
}

export interface VerificationEmail {
	to: string;
	verifyUrl: string;
}

/**
 * Send the email-verification email for a newly registered address.
 */
export async function sendVerificationEmail({
	to,
	verifyUrl,
}: VerificationEmail): Promise<void> {
	await sendMail({
		to,
		subject: "Verify your email — Chewables",
		link: verifyUrl,
		html: [
			"<p>Thanks for creating an account with Chewables.</p>",
			"<p>Please confirm your email address to finish signing up (this also lets",
			" Google sign-in link to your account automatically).</p>",
			`<p><a href="${verifyUrl}">Verify my email</a></p>`,
		].join("\n"),
	});
}

/**
 * Send the confirmation link for a new address during an email change. Better
 * Auth routes this through the same `sendVerificationEmail` callback, so the
 * caller picks the wording; the link itself is identical.
 */
export async function sendNewEmailVerification({
	to,
	verifyUrl,
}: VerificationEmail): Promise<void> {
	await sendMail({
		to,
		subject: "Confirm your new email — Chewables",
		link: verifyUrl,
		html: [
			"<p>Confirm this address to finish changing the email on your Chewables account.</p>",
			"<p>If you didn't ask for this, you can ignore this email — your address stays",
			" exactly as it is.</p>",
			`<p><a href="${verifyUrl}">Confirm my new email</a></p>`,
		].join("\n"),
	});
}
