<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';

	let { onCancel }: { onCancel: () => void } = $props();
</script>

<Modal onClose={onCancel}>
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="googleAuthTitle">
		<span class="spinner" aria-hidden="true"></span>
		<p id="googleAuthTitle" class="modal-text">Connecting your Google account…</p>
		<button type="button" class="modal-cancel" onclick={onCancel}>Cancel</button>
	</div>
</Modal>

<style>
	.modal {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: 1.75rem 2rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--ink);
		text-align: center;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
		font-family: var(--font-ui);
	}
	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--line);
		border-top-color: var(--ember);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.modal-text {
		margin: 0;
		font-size: var(--text-base);
		font-weight: 600;
	}
	.modal-cancel {
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		color: var(--ink-soft);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		text-decoration: underline;
	}
	.modal-cancel:hover {
		color: var(--ember);
	}
</style>
