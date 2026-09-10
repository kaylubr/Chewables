// @vitest-environment jsdom
import { createRawSnippet } from 'svelte';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';

const body = createRawSnippet(() => ({
	render: () => '<p>Body text</p>'
}));

function setup(overrides: Record<string, unknown> = {}) {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	return {
		onConfirm,
		onCancel,
		...render(ConfirmDialog, {
			props: {
				open: true,
				title: 'Delete this photo?',
				confirmLabel: 'Delete photo',
				cancelLabel: 'Keep it',
				onConfirm,
				onCancel,
				children: body,
				...overrides
			}
		})
	};
}

function button(name: string): HTMLButtonElement {
	return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('ConfirmDialog', () => {
	it('renders the title, body, and both actions when open', () => {
		setup();
		expect(document.body.textContent).toContain('Delete this photo?');
		expect(document.body.textContent).toContain('Body text');
		expect(button('Keep it')).toBeTruthy();
		expect(button('Delete photo')).toBeTruthy();
	});

	it('renders nothing when closed', () => {
		setup({ open: false });
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it('focuses the least destructive action when it opens', async () => {
		setup();
		await waitFor(() => expect(document.activeElement).toBe(button('Keep it')));
	});

	it('calls onCancel when the cancel action is clicked', async () => {
		const { onCancel, onConfirm } = setup();
		await fireEvent.click(button('Keep it'));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('calls onConfirm when the confirm action is clicked', async () => {
		const { onConfirm, onCancel } = setup();
		await fireEvent.click(button('Delete photo'));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('calls onCancel on Escape', async () => {
		const { onCancel } = setup();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('ignores Escape while closed', async () => {
		const { onCancel } = setup({ open: false });
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('disables the confirm action and shows the busy label while working', () => {
		setup({ busy: true, busyLabel: 'Deleting…' });
		const busy = button('Deleting…');
		expect(busy.disabled).toBe(true);
		expect(button('Keep it').disabled).toBe(false);
	});

	it('disables the confirm action when confirmation is not yet allowed', () => {
		setup({ confirmDisabled: true });
		expect(button('Delete photo').disabled).toBe(true);
	});
});
