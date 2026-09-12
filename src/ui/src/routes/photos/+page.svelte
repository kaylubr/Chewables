<script lang="ts">
import { onMount, tick } from "svelte";
import { goto } from "$app/navigation";
import { ApiError } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
import Lightbox from "$lib/components/Lightbox.svelte";
import NoPhotosIcon from "$lib/components/NoPhotosIcon.svelte";
import { PhotoCollection, type DisplayPhoto } from "$lib/photos/collection.svelte";
import PhotoTile from "$lib/photos/PhotoTile.svelte";
import { toastStore } from "$lib/toasts/toasts.svelte";

const collection = new PhotoCollection();
let deleting = $state<string | null>(null);
let pendingDelete = $state<DisplayPhoto | null>(null);
let lightboxIndex = $state<number | null>(null);
let heading = $state<HTMLHeadingElement | undefined>();
let emptyHeading = $state<HTMLHeadingElement | undefined>();

function openViewer(photo: { id: string }) {
	const at = collection.viewerIndex(photo.id);
	if (at !== -1) lightboxIndex = at;
}

function requestRemove(photo: DisplayPhoto) {
	pendingDelete = photo;
}

function closeConfirm() {
	pendingDelete = null;
}

async function load() {
	const user = await auth.ensureSession();
	if (!user) {
		goto("/login");
		return;
	}
	await collection.load();
	if (collection.failed) {
		toastStore.error(collection.failureMessage || "Could not load your photos.");
	}
}

async function confirmRemove() {
	const photo = pendingDelete;
	if (!auth.isAuthenticated || !photo) return;
	pendingDelete = null;
	deleting = photo.id;
	try {
		await collection.remove(photo.id);
		toastStore.success("Photo deleted.");
		await tick();
		(heading ?? emptyHeading)?.focus();
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

<main class="gallery" inert={pendingDelete !== null || lightboxIndex !== null}>
	{#if !collection.isEmpty}
		<h1 bind:this={heading} tabindex="-1">Photos</h1>
	{/if}

	{#if collection.loading}
		<p class="empty">Loading…</p>
	{:else if collection.failed}
		<p class="empty">Couldn't load your photos.</p>
		<button type="button" class="secondary" onclick={load}>Retry</button>
	{:else if collection.photos.length === 0}
		<div class="empty-state">
			<NoPhotosIcon />
			<h2 bind:this={emptyHeading} tabindex="-1">No photos yet</h2>
			<p>Anything you save from the photobooth shows up here.</p>
			<a class="cta" href="/photobooth/frame">Take a photo</a>
		</div>
	{:else}
		<div class="grid">
			{#each collection.photos as photo (photo.id)}
				<PhotoTile
					{photo}
					label={photo.createdAt}
					deleting={deleting === photo.id}
					onOpen={() => openViewer(photo)}
					onDelete={() => requestRemove(photo)}
				/>
			{/each}
		</div>
	{/if}
</main>

{#if pendingDelete}
	<ConfirmDialog
		open
		title="Delete this photo?"
		confirmLabel="Delete photo"
		cancelLabel="Keep it"
		destructive
		busy={deleting !== null}
		busyLabel="Deleting…"
		onConfirm={() => void confirmRemove()}
		onCancel={closeConfirm}
	>
		<p>
			{#if pendingDelete.frame}
				The {pendingDelete.frame.toLowerCase()} photo from{' '}
			{:else}
				This photo from{' '}
			{/if}
			{new Date(pendingDelete.createdAt).toLocaleDateString()} will be deleted for
			good. This cannot be undone.
		</p>
	</ConfirmDialog>
{/if}

{#if lightboxIndex !== null}
	<Lightbox
		photos={collection.viewable}
		index={lightboxIndex}
		onClose={() => (lightboxIndex = null)}
	/>
{/if}

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
		align-items: start;
	}

	.empty {
		color: var(--ink-soft);
	}

	.empty-state {
		position: fixed;
		inset: 0;
		overflow: auto;
		display: grid;
		place-content: center;
		place-content: safe center;
		justify-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		text-align: center;
		color: var(--ink-faint);
	}

	.empty-state h2 {
		margin: 0;
		font-size: var(--text-xl);
		color: var(--ink);
	}

	.empty-state p {
		margin: 0;
		max-width: var(--measure);
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	.cta {
		margin-top: 0.75rem;
		padding: 0.7rem 1.3rem;
		border-radius: 0.5rem;
		background: var(--ember);
		color: #fff;
		font-family: var(--font-ui);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	.cta:hover {
		background: var(--ember-deep);
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
		.cta {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
	}
</style>