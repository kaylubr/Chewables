<script lang="ts">
import { onMount, tick } from "svelte";
import { goto } from "$app/navigation";
import { ApiError, api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
import Lightbox from "$lib/components/Lightbox.svelte";
import NoPhotosIcon from "$lib/components/NoPhotosIcon.svelte";
import { frameAspectRatio } from "$lib/frames/frames";
import { toastStore } from "$lib/toasts/toasts.svelte";
import type { SavedPhoto } from "@chewable/shared";

type DisplayPhoto = SavedPhoto & { displayUrl?: string };

let photos = $state<DisplayPhoto[]>([]);
let loading = $state(true);
let loadFailed = $state(false);
let deleting = $state<string | null>(null);
let pendingDelete = $state<DisplayPhoto | null>(null);
let lightboxIndex = $state<number | null>(null);
let heading = $state<HTMLHeadingElement | undefined>();
let emptyHeading = $state<HTMLHeadingElement | undefined>();

const isEmpty = $derived(!loading && !loadFailed && photos.length === 0);

const viewable = $derived(
	photos
		.filter((p): p is DisplayPhoto & { displayUrl: string } =>
			Boolean(p.displayUrl),
		)
		.map((p) => ({ id: p.id, url: p.displayUrl })),
);

function openViewer(photo: DisplayPhoto) {
	const at = viewable.findIndex((p) => p.id === photo.id);
	if (at !== -1) lightboxIndex = at;
}

function requestRemove(photo: DisplayPhoto) {
	pendingDelete = photo;
}

function closeConfirm() {
	pendingDelete = null;
}

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
	deleting = photo.id;
	try {
		await api.deletePhoto(photo.id);
		photos = photos.filter((p) => p.id !== photo.id);
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
	{#if !isEmpty}
		<h1 bind:this={heading} tabindex="-1">Photos</h1>
	{/if}

	{#if loading}
		<p class="empty">Loading…</p>
	{:else if loadFailed}
		<p class="empty">Couldn't load your photos.</p>
		<button type="button" class="secondary" onclick={load}>Retry</button>
	{:else if photos.length === 0}
		<div class="empty-state">
			<NoPhotosIcon />
			<h2 bind:this={emptyHeading} tabindex="-1">No photos yet</h2>
			<p>Anything you save from the photobooth shows up here.</p>
			<a class="cta" href="/photobooth/frame">Take a photo</a>
		</div>
	{:else}
		<div class="grid">
			{#each photos as photo (photo.id)}
				<figure class="tile" style:aspect-ratio={frameAspectRatio(photo.frame)}>
					<button
						type="button"
						class="open"
						aria-label={`View the photo from ${photo.createdAt}`}
						disabled={!photo.displayUrl}
						onclick={() => openViewer(photo)}
					>
						{#if photo.displayUrl}
							<img src={photo.displayUrl} alt="Saved photobooth result" loading="lazy" />
						{:else}
							<div class="placeholder">unavailable</div>
						{/if}
					</button>
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
		photos={viewable}
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
		.delete {
			opacity: 1;
			width: 2.75rem;
			height: 2.75rem;
			font-size: 1.5rem;
		}

		.cta {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
	}
</style>