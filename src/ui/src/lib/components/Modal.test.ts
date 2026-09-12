// @vitest-environment jsdom
import { createRawSnippet } from 'svelte';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal.svelte';

const body = createRawSnippet(() => ({
	render: () => '<div><button>Cancel</button><button>Confirm</button></div>'
}));

function setup(overrides: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	return {
		onClose,
		...render(Modal, { props: { onClose, children: body, ...overrides } })
	};
}

function backdrop(): HTMLElement {
	return document.querySelector('.backdrop') as HTMLElement;
}

describe('Modal', () => {
	it('focuses the first actionable child when it opens', async () => {
		setup();
		await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })));
	});

	it('returns focus to whatever was focused before it opened', () => {
		const trigger = document.createElement('button');
		document.body.append(trigger);
		trigger.focus();

		const { unmount } = setup();
		unmount();

		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it('calls onClose on Escape', async () => {
		const { onClose } = setup();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('ignores keys other than Escape', async () => {
		const { onClose } = setup();
		await fireEvent.keyDown(window, { key: 'a' });
		expect(onClose).not.toHaveBeenCalled();
	});

	it('does not close on a backdrop click by default', async () => {
		const { onClose } = setup();
		await fireEvent.click(backdrop());
		expect(onClose).not.toHaveBeenCalled();
	});

	it('closes on a backdrop click when asked', async () => {
		const { onClose } = setup({ backdropClose: true });
		await fireEvent.click(backdrop());
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close when the click lands on the dialog content', async () => {
		const { onClose } = setup({ backdropClose: true });
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onClose).not.toHaveBeenCalled();
	});
});
