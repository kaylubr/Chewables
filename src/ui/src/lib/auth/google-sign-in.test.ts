import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSignInFlow } from './google-sign-in.svelte';

const { startGoogleSignIn } = vi.hoisted(() => ({ startGoogleSignIn: vi.fn() }));

vi.mock('./oauth', async () => {
	const actual = await vi.importActual<typeof import('./oauth')>('./oauth');
	return { ...actual, startGoogleSignIn };
});

function settled(outcome: unknown) {
	return { cancel: vi.fn(), result: Promise.resolve(outcome) };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GoogleSignInFlow', () => {
	it('starts the popup with the next path', async () => {
		startGoogleSignIn.mockReturnValue(settled({ status: 'error', message: 'nope' }));
		const flow = new GoogleSignInFlow();

		const outcome = await flow.start('/photos');

		expect(startGoogleSignIn).toHaveBeenCalledWith('/photos');
		expect(outcome).toEqual({ status: 'error', message: 'nope' });
	});

	it('clears pending when the attempt did not succeed', async () => {
		startGoogleSignIn.mockReturnValue(settled({ status: 'error', message: 'nope' }));
		const flow = new GoogleSignInFlow();

		await flow.start('/photos');

		expect(flow.pending).toBe(false);
	});

	it('stays pending on success, because the caller navigates away', async () => {
		startGoogleSignIn.mockReturnValue(
			settled({ status: 'success', user: { id: 'u1' } })
		);
		const flow = new GoogleSignInFlow();

		await flow.start('/photos');

		expect(flow.pending).toBe(true);
	});

	it('ignores a second start while one is in flight', async () => {
		let settle: (outcome: unknown) => void = () => {};
		const result = new Promise((resolve) => {
			settle = resolve;
		});
		startGoogleSignIn.mockReturnValue({ cancel: vi.fn(), result });
		const flow = new GoogleSignInFlow();

		const first = flow.start('/photos');
		const second = await flow.start('/photos');

		expect(second).toBeNull();
		expect(startGoogleSignIn).toHaveBeenCalledTimes(1);

		settle({ status: 'error', message: 'nope' });
		await first;
	});

	it('cancels the in-flight popup', async () => {
		let settle: (outcome: unknown) => void = () => {};
		const cancel = vi.fn();
		const result = new Promise((resolve) => {
			settle = resolve;
		});
		startGoogleSignIn.mockReturnValue({ cancel, result });
		const flow = new GoogleSignInFlow();

		const started = flow.start('/photos');
		flow.cancel();

		expect(cancel).toHaveBeenCalledTimes(1);
		settle({ status: 'closed' });
		await started;
	});
});
