import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toastStore } from './toasts.sveltection clearToasts() {
	for (const t of toastStore.toasts) toastStore.dismiss(t.id);
}

describe('toast store', () => {
	beforeEach(() => {
		clearToasts();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts empty', () => {
		expect(toastStore.toasts).toEqual([]);
	});

	it('push adds a toast with its kind and message', () => {
		toastStore.push('error', 'Could not sign in.');
		expect(toastStore.toasts).toEqual([
			{ id: expect.any(Number), kind: 'error', message: 'Could not sign in.' },
		]);
	});

	it('success and error helpers push the right kind', () => {
		toastStore.success('Photo saved.');
		toastStore.error('Photo save failed.');
		expect(toastStore.toasts.map((t) => [t.kind, t.message])).toEqual([
			['success', 'Photo saved.'],
			['error', 'Photo save failed.'],
		]);
	});

	it('keeps at most three toasts, dropping the oldest', () => {
		toastStore.push('success', 'one');
		toastStore.push('success', 'two');
		toastStore.push('success', 'three');
		toastStore.push('error', 'four');
		expect(toastStore.toasts.map((t) => t.message)).toEqual(['two', 'three', 'four']);
	});

	it('dismiss removes a specific toast by id', () => {
		const first = toastStore.push('success', 'one');
		toastStore.push('error', 'two');
		toastStore.dismiss(first);
		expect(toastStore.toasts.map((t) => t.message)).toEqual(['two']);
	});

	it('auto-dismisses success after 3s and error after 6s', () => {
		toastStore.success('signed in');
		toastStore.error('failed');
		expect(toastStore.toasts).toHaveLength(2);

		vi.advanceTimersByTime(2999);
		expect(toastStore.toasts).toHaveLength(2);

		vi.advanceTimersByTime(1);
		expect(toastStore.toasts.map((t) => t.kind)).toEqual(['error']);

		vi.advanceTimersByTime(2999);
		expect(toastStore.toasts.map((t) => t.kind)).toEqual(['error']);

		vi.advanceTimersByTime(1);
		expect(toastStore.toasts).toEqual([]);
	});
});
