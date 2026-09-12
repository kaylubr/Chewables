import { startGoogleSignIn, type GoogleAuthController, type GoogleAuthResult } from './oauth';

/**
 * The pending state behind one Google sign-in attempt, shared by the login and
 * register pages.
 *
 * `start` must be reached synchronously from the click handler so the browser
 * does not block the popup. It keeps `pending` true on success, because the
 * caller is about to navigate away from under the prompt.
 */
export class GoogleSignInFlow {
	pending = $state(false);
	#flow: GoogleAuthController | null = null;

	async start(next: string): Promise<GoogleAuthResult | null> {
		if (this.pending) return null;
		this.pending = true;
		const flow = startGoogleSignIn(next);
		this.#flow = flow;
		const outcome = await flow.result;
		this.#flow = null;
		if (outcome.status !== 'success') this.pending = false;
		return outcome;
	}

	cancel(): void {
		this.#flow?.cancel();
	}
}
