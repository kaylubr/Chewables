<script lang="ts">
	import { onMount } from 'svelte';
	import { api, ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import { toastStore } from '$lib/toasts.svelte';
	import type { SavedPhoto } from '@chewable/shared';

	type DisplayPhoto = SavedPhoto & { displayUrl?: string };

	let photos = $state<DisplayPhoto[]>([]);
	let loading = $state(true);
	let loadFailed = $state(false);
	let deleting = $state<string | null>(null);

	async function load() {
		loadFailed = false;
		if (!auth.isAuthenticated) return;
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
				})
			);
		} catch (e) {
			loadFailed = true;
			toastStore.error(e instanceof ApiError ? e.message : 'Could not load your photos.');
		} finally {
			loading = false;
		}
	}

	async function remove(id: string) {
		if (!auth.isAuthenticated) return;
		deleting = id;
		try {
			await api.deletePhoto(id);
			photos = photos.filter((p) => p.id !== id);
			toastStore.success('Photo deleted.');
		} catch (e) {
			toastStore.error(e instanceof ApiError ? e.message : 'Could not delete the photo.');
		} finally {
			deleting = null;
		}
	}

	onMount(() => {
		void load();
	});
</script>

<svelte:head>
	<title>My photos — Chewables</title>
</svelte:head>

<main class="gallery">
	<h1>My photos</h1>

	{#if !auth.isAuthenticated}
		<p class="empty">
			<a href="/login">Sign in</a> to see the photos you've saved.
		</p>
	{:else if loading}
		<p class="empty">Loading…</p>
	{:else if loadFailed}
		<p class="empty">Couldn't load your photos.</p>
		<button type="button" class="secondary" onclick={load}>Retry</button>
	{:else if photos.length === 0}
		<p class="empty">
			No saved photos yet. Take one in the{' '}
			<a href="/photobooth/frame">photobooth</a>.
		</p>
	{:else}
		<div class="grid">
			{#each photos as photo (photo.id)}
				<figure class="card">
					{#if photo.displayUrl}
						<img src={photo.displayUrl} alt="Saved photobooth result" />
					{:else}
						<div class="placeholder">unavailable</div>
					{/if}
					<figcaption>
						<span>
							{photo.frame} · {new Date(photo.createdAt).toLocaleDateString()}
						</span>
						<button
							type="button"
							class="delete"
							onclick={() => void remove(photo.id)}
							disabled={deleting === photo.id}
						>
							{deleting === photo.id ? 'Deleting…' : 'Delete'}
						</button>
					</figcaption>
				</figure>
			{/each}
		</div>
	{/if}
</main>

<style>
	.gallery {
		max-width: 72rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}
	.gallery h1 {
		font-weight: 640;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}
	.card {
		margin: 0;
		background: var(--surface);
		border-radius: 0.75rem;
		overflow: hidden;
		box-shadow: 0 2px 10px oklch(0.28 0.03 55 / 0.08);
	}
	.card img {
		width: 100%;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		display: block;
	}
	.placeholder {
		aspect-ratio: 9 / 16;
		display: grid;
		place-items: center;
		color: var(--ink-faint);
		background: var(--surface-2);
		font-size: var(--text-sm);
	}
	.card figcaption {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}
	.delete {
		background: none;
		border: 1px solid var(--danger-line);
		color: var(--danger);
		border-radius: 0.4rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}
	.delete:hover {
		background: var(--danger-bg);
	}
	.empty {
		color: var(--ink-soft);
		margin-top: 2rem;
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
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 1rem;
		}
	}
	@media (pointer: coarse) {
		.delete {
			min-width: 44px;
			min-height: 44px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
