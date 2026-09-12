<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Modal shell: the backdrop, Escape dismissal, and the focus contract.
	 *
	 * Callers mount it only while their dialog is open, so it can capture the
	 * element that had focus on mount and hand it back on destroy. It moves
	 * focus to the first actionable child — the least destructive action is
	 * first in the DOM by convention — and reports Escape, plus a backdrop
	 * click when the caller opts in, through `onClose`. Callers mark the page
	 * behind it `inert` so the dialog is the only thing reachable.
	 */
	let {
		onClose,
		backdropClose = false,
		children,
	}: {
		onClose?: () => void;
		backdropClose?: boolean;
		children?: Snippet;
	} = $props();

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	let backdrop = $state<HTMLElement | undefined>();
	let returnFocus: HTMLElement | null = null;

	onMount(() => {
		returnFocus = document.activeElement as HTMLElement | null;
		// Deferred a microtask so the browser is done placing the dialog before
		// focus moves into it.
		queueMicrotask(() => backdrop?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
		return () => returnFocus?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		onClose?.();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (!backdropClose || event.target !== backdrop) return;
		onClose?.();
	}
</script>

<!-- Keyboard dismissal lives on svelte:window: an element-level handler would
     miss key presses once focus leaves the dialog. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" bind:this={backdrop} onclick={handleBackdropClick}>
	{@render children?.()}
</div>

<svelte:window onkeydown={handleKeydown} />

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: rgb(0 0 0 / 0.45);
		z-index: 70;
	}
</style>
