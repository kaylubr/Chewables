<script lang="ts">
	import type { Snippet } from 'svelte';
	import Modal from './Modal.svelte';

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

	const titleId = `confirm-title-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if open}
	<Modal onClose={onCancel}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
			<h2 id={titleId}>{title}</h2>
			{#if children}
				<div class="modal-body">{@render children()}</div>
			{/if}
			<div class="modal-actions">
				<button type="button" class="cancel" onclick={onCancel}>
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
	</Modal>
{/if}

<style>
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
		font-family: var(--font-ui);
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
		font-family: var(--font-ui);
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
