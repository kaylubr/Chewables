<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Confirmation dialog for an action that changes something.
	 *
	 * Focuses the cancel button when it opens (the least destructive choice),
	 * closes on Escape or a backdrop click, and hands focus back to whatever
	 * was focused before it opened. Callers mark the page behind it `inert` so
	 * the dialog is the only thing reachable.
	 */
	let {
		open,
		title,
		confirmLabel,
		busyLabel,
		cancelLabel = 'Cancel',
		destructive = false,
		busy = false,
		confirmDisabled = false,
		onConfirm,
		onCancel,
		children,
	}: {
		open: boolean;
		title: string;
		confirmLabel: string;
		busyLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		busy?: boolean;
		confirmDisabled?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		children?: Snippet;
	} = $props();

	// Several dialogs can be mounted at once (each closed), so the label id has
	// to be unique per instance rather than a fixed string.
	const titleId = `confirm-title-${Math.random().toString(36).slice(2, 9)}`;

	let cancelButton = $state<HTMLButtonElement | undefined>();
	let returnFocus: HTMLElement | null = null;
	let wasOpen = false;

	$effect(() => {
		if (open) {
			if (!wasOpen) {
				returnFocus = document.activeElement as HTMLElement | null;
				wasOpen = true;
			}
			cancelButton?.focus();
			return;
		}
		if (!wasOpen) return;
		wasOpen = false;
		// A no-op when the trigger is gone (for example the deleted photo), in
		// which case the caller moves focus somewhere sensible afterwards.
		returnFocus?.focus();
		returnFocus = null;
	});
</script>

{#if open}
	<div class="modal-backdrop">
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
			<h2 id={titleId}>{title}</h2>
			{#if children}
				<div class="modal-body">{@render children()}</div>
			{/if}
			<div class="modal-actions">
				<button type="button" class="cancel" bind:this={cancelButton} onclick={onCancel}>
					{cancelLabel}
				</button>
				<button
					type="button"
					class:destructive
					class:confirm={!destructive}
					disabled={busy || confirmDisabled}
					onclick={onConfirm}
				>
					{busy ? (busyLabel ?? 'Working…') : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}}
/>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(0 0 0 / 0.45);
		padding: 1.5rem;
		z-index: 70;
	}

	.modal {
		width: min(26rem, 100%);
		padding: 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
		font-family: var(--font-ui);
	}

	.modal h2 {
		margin: 0 0 0.5rem;
		font-size: var(--text-xl);
	}

	.modal-body {
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	.modal-body :global(p) {
		margin: 0;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		flex-wrap: wrap;
		margin-top: 1.25rem;
	}

	.cancel {
		background: none;
		border: 1px solid var(--line-strong);
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}

	.cancel:hover {
		border-color: var(--ember);
		color: var(--ember);
	}

	.confirm,
	.destructive {
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		color: #fff;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}

	.confirm {
		background: var(--ember);
	}

	.confirm:hover {
		background: var(--ember-deep);
	}

	.destructive {
		background: var(--danger);
	}

	.destructive:hover {
		background: color-mix(in srgb, var(--danger) 85%, black);
	}

	.confirm:disabled,
	.destructive:disabled {
		opacity: 0.6;
		cursor: default;
	}

	@media (pointer: coarse) {
		.cancel,
		.confirm,
		.destructive {
			min-height: 44px;
		}
	}
</style>
