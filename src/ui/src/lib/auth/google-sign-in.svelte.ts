import { startGoogleSignIn, type GoogleAuthController, type GoogleAuthResult } from './oauth';

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
