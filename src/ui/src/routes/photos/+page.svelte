<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { ApiError, api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import { toastStore } from "$lib/toasts/toasts.svelte";
import type { SavedPhoto } from "@chewable/shared";

type DisplayPhoto = SavedPhoto & { displayUrl?: string };

let photos = $state<DisplayPhoto[]>([]);
let loading = $state(true);
let loadFailed = $state(false);
let deleting = $state<string | null>(null);
// Deletion is permanent (row + stored object both go), so it goes through a
// confirm step instead of firing on the first click.
let pendingDelete = $state<DisplayPhoto | null>(null);
let keepButton = $state<HTMLButtonElement | undefined>();
let heading = $state<HTMLHeadingElement | undefined>();
// The element to hand focus back to when the confirm closes.
let returnFocus: HTMLElement | null = null;

function requestRemove(photo: DisplayPhoto) {
	returnFocus = document.activeElement as HTMLElement | null;
	pendingDelete = photo;
}

function closeConfirm() {
	pendingDelete = null;
	returnFocus?.focus();
	returnFocus = null;
}

// Move focus to the least destructive action when the confirm opens.
$effect(() => {
	if (pendingDelete) keepButton?.focus();
});

async function load() {
	loadFailed = false;
	const user = await auth.ensureSession();
	if (!user) {
		goto("/login");
		return;
	}
	loading = true;
	try {
		const data = await api.listPhotos();
		photos = await Promise.all(
			data.map(async (p) => {
				try {
					const { url } = await api.photoUrl(p.id);
					return { ...p, displayUrl: url };
				} catch {
					return { ...p, displayUrl: undefined };
				}
			}),
		);
	} catch (e) {
		loadFailed = true;
		toastStore.error(
			e instanceof ApiError ? e.message : "Could not load your photos.",
		);
	} finally {
		loading = false;
	}
}

async function confirmRemove() {
	const photo = pendingDelete;
	if (!auth.isAuthenticated || !photo) return;
	pendingDelete = null;
	returnFocus = null;
	deleting = photo.id;
	try {
		await api.deletePhoto(photo.id);
		photos = photos.filter((p) => p.id !== photo.id);
		toastStore.success("Photo deleted.");
		// The trigger tile is gone, so hand focus to the section heading.
		heading?.focus();
	} catch (e) {
		toastStore.error(
			e instanceof ApiError ? e.message : "Could not delete the photo.",
		);
	} finally {
		deleting = null;
	}
}

onMount(() => {
	void load();
});
</script>

<svelte:head>
	<title>Photos</title>
</svelte:head>

<main class="gallery" inert={pendingDelete !== null}>
	<h1 bind:this={heading} tabindex="-1">Photos</h1>

	{#if loading}
		<p class="empty">Loading…</p>
	{:else if loadFailed}
		<p class="empty">Couldn't load your photos.</p>
		<button type="button" class="secondary" onclick={load}>Retry</button>
	{:else if photos.length === 0}
		<p class="empty">
			No saved photos yet. Take one in the <a href="/photobooth/frame">photobooth</a>.
		</p>
	{:else}
		<div class="grid">
			{#each photos as photo (photo.id)}
				<figure class="tile">
					{#if photo.displayUrl}
						<img src={photo.displayUrl} alt="Saved photobooth result" loading="lazy" />
					{:else}
						<div class="placeholder">unavailable</div>
					{/if}
					<span class="frame-label">{photo.frame}</span>
					<button
						type="button"
						class="delete"
						aria-label={`Delete photo from ${photo.createdAt}`}
						onclick={() => requestRemove(photo)}
						disabled={deleting === photo.id}
					>
						{deleting === photo.id ? '…' : '×'}
					</button>
				</figure>
			{/each}
		</div>
	{/if}
</main>

{#if pendingDelete}
	<div class="modal-backdrop">
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
			<h2 id="delete-title">Delete this photo?</h2>
			<p>
				{#if pendingDelete.frame}
					The {pendingDelete.frame.toLowerCase()} photo from{' '}
				{:else}
					This photo from{' '}
				{/if}
				{new Date(pendingDelete.createdAt).toLocaleDateString()} will be deleted for
				good. This cannot be undone.
			</p>
			<div class="modal-actions">
				<button
					type="button"
					class="secondary"
					bind:this={keepButton}
					onclick={closeConfirm}
				>
					Keep it
				</button>
				<button type="button" class="destructive" onclick={() => void confirmRemove()}>
					Delete photo
				</button>
			</div>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && pendingDelete) closeConfirm();
	}}
/>

<style>
	.gallery {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 3rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}

	.gallery h1 {
		margin: 0 0 1rem;
		font-size: var(--text-xl);
		font-weight: 700;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.35rem;
	}

	.tile {
		position: relative;
		margin: 0;
		aspect-ratio: 1 / 1;
		background: var(--surface-2);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.tile img,
	.placeholder {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
		font-family: var(--font-mono);
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

	.empty {
		color: var(--ink-soft);
	}

	.secondary {
		background: var(--dev-bg);
		color: var(--dev-ink);
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
		font-size: var(--text-base);
		margin-top: 1rem;
	}

	.secondary:hover {
		background: var(--ink);
	}

	@media (min-width: 560px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
		}
	}

	@media (pointer: coarse) {
		.delete {
			opacity: 1;
			width: 2.75rem;
			height: 2.75rem;
			font-size: 1.5rem;
		}
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(0 0 0 / 0.45);
		padding: 1.5rem;
		z-index: 50;
	}
	.modal {
		width: min(26rem, 100%);
		padding: 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
	}
	.modal h2 {
		margin: 0 0 0.5rem;
		font-size: var(--text-xl);
	}
	.modal p {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}
	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		flex-wrap: wrap;
		margin-top: 1.25rem;
	}
	.modal-actions .secondary {
		margin-top: 0;
		background: none;
		border: 1px solid var(--line-strong);
		color: var(--ink);
	}
	.modal-actions .secondary:hover {
		border-color: var(--ember);
		color: var(--ember);
		background: none;
	}
	.destructive {
		background: var(--danger);
		color: #fff;
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 650;
		cursor: pointer;
	}
	.destructive:hover {
		background: color-mix(in srgb, var(--danger) 85%, black);
	}
	@media (pointer: coarse) {
		.modal-actions .secondary,
		.destructive {
			min-height: 44px;
		}
	}
</style>