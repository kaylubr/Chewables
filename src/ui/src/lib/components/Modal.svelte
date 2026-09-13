<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

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
