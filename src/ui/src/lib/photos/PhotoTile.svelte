<script lang="ts">
	import { frameAspectRatio } from '$lib/frames/frames';
	import type { DisplayPhoto } from './collection.svelte';

	let {
		photo,
		label,
		onOpen,
		onDelete,
		deleting = false,
		zoom = false,
	}: {
		photo: DisplayPhoto;
		label: string;
		onOpen: () => void;
		onDelete?: () => void;
		deleting?: boolean;
		zoom?: boolean;
	} = $props();
</script>

<figure class="tile" class:zoom style:aspect-ratio={frameAspectRatio(photo.frame)}>
	<button
		type="button"
		class="open"
		aria-label={`View the photo from ${label}`}
		disabled={!photo.displayUrl}
		onclick={onOpen}
	>
		{#if photo.displayUrl}
			<img src={photo.displayUrl} alt="Saved photobooth result" loading="lazy" />
		{:else}
			<div class="placeholder">unavailable</div>
		{/if}
	</button>
	<span class="frame-label">{photo.frame}</span>
	{#if onDelete}
		<button
			type="button"
			class="delete"
			aria-label={`Delete photo from ${label}`}
			onclick={onDelete}
			disabled={deleting}
		>
			{deleting ? '…' : '×'}
		</button>
	{/if}
</figure>

<style>
	.tile {
		position: relative;
		margin: 0;
		background: var(--surface-2);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.open {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
	}

	.open:disabled {
		cursor: default;
	}

	.tile img,
	.placeholder {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.tile img {
		transition: transform 0.2s ease;
	}

	.tile.zoom .open:hover img {
		transform: scale(1.03);
	}

	.placeholder {
		display: grid;
		place-items: center;
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}

	.frame-label {
		position: absolute;
		left: 0.45rem;
		bottom: 0.45rem;
		padding: 0.15rem 0.4rem;
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--stage-ink);
		background: rgb(0 0 0 / 0.45);
		border-radius: 0.3rem;
		pointer-events: none;
	}

	.delete {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
		width: 1.75rem;
		height: 1.75rem;
		display: grid;
		place-items: center;
		background: rgb(0 0 0 / 0.5);
		color: #fff;
		border: none;
		border-radius: 50%;
		font-family: var(--font-ui);
		font-size: var(--text-lg);
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.tile:hover .delete,
	.delete:focus-visible {
		opacity: 1;
	}

	.delete:active {
		background: var(--danger);
	}

	@media (pointer: coarse) {
		.delete {
			opacity: 1;
			width: 2.75rem;
			height: 2.75rem;
			font-size: 1.5rem;
		}
	}
</style>
