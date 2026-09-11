import { Resend } from "resend";
import { config } from "../config.js";

const resend = config.mail.apiKey ? new Resend(config.mail.apiKey) : null;

interface MailMessage {
	to: string;
	subject: string;
	html: string;
	link: string;
}

/**
 * Domains that can never receive mail: RFC 2606 reserves example.com/net/org,
 * .test, .invalid and .localhost, and Resend refuses them before delivery.
 */
const UNDELIVERABLE_DOMAINS = [
	"example.com",
	"example.net",
	"example.org",
	"example",
	"test",
	"invalid",
	"localhost",
];

/** True for an address Resend will always reject, e.g. someone@example.com. */
export function isUndeliverable(to: string): boolean {
	const domain = to.slice(to.lastIndexOf("@") + 1).toLowerCase();
	return UNDELIVERABLE_DOMAINS.some(
		(reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
	);
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

async function sendMail({ to, subject, html, link }: MailMessage): Promise<void> {
	// Log the link instead of sending when there is nothing to send with, in
	// tests, or to an address that can never receive mail.
	if (!resend || config.isTest || isUndeliverable(to)) {
		const reason = !resend
			? "no RESEND_API_KEY"
			: config.isTest
				? "suppressed in testing"
				: "undeliverable address";
		console.info(`[mail] not sent (${reason}); "${subject}" for ${to}: ${link}`);
		return;
	}

	// The SDK resolves with `{ error }` rather than rejecting, so a refused send
	// has to be read off the result. Still fire-and-forget: a mail outage must
	// not fail the request that triggered it.
	void resend.emails
		.send({
			from: config.mail.from,
			to,
			subject,
			html,
		})
		.then(({ error }) => {
			if (error) {
				console.error(
					`[mail] delivery failed for "${subject}" to ${to}: ${error.message}`,
				);
			}
		})
		.catch((err) => {
			console.error(
				`[mail] delivery failed for "${subject}" to ${to}: ${errorMessage(err)}`,
			);
		});
}

export interface VerificationEmail {
	to: string;
	verifyUrl: string;
}

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
