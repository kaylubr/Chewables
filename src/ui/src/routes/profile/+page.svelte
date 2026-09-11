<script lang="ts">
import { goto } from "$app/navigation";
import { api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import type { AuthUser, SavedPhoto } from "@chewable/shared";
import { onMount } from "svelte";

type DisplayPhoto = SavedPhoto & { displayUrl?: string };

const RECENT_LIMIT = 4;

let showEmail = $state(false);
// Snapshot of the authenticated user for the template, so Svelte can narrow
// it inside the `{:else}` branch after the auth gate.
let user = $state<AuthUser | null>(null);
let photos = $state<DisplayPhoto[]>([]);
// Only the newest few photos get a signed URL, so this stays a teaser of the
// gallery at /photos rather than a second copy of it.
let recent = $state<DisplayPhoto[]>([]);
let photosLoading = $state(true);
let photosFailed = $state(false);

function initials(username: string): string {
	return username.trim().slice(0, 2).toUpperCase() || "?";
}

function memberSince(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

async function loadPhotos() {
	photosFailed = false;
	photosLoading = true;
	try {
		const data = await api.listPhotos();
		photos = data;
		// The API returns photos oldest-first, so the newest are at the tail.
		const newest = data.slice(-RECENT_LIMIT).reverse();
		recent = await Promise.all(
			newest.map(async (p) => {
				try {
					const { url } = await api.photoUrl(p.id);
					return { ...p, displayUrl: url };
				} catch {
					return { ...p, displayUrl: undefined };
				}
			}),
		);
	} catch {
		// The profile is a secondary surface, so a quiet inline fallback beats
		// a toast here.
		photosFailed = true;
		photos = [];
		recent = [];
	} finally {
		photosLoading = false;
	}
}

onMount(async () => {
	const loaded = await auth.ensureSession();
	if (!loaded) {
		goto("/login");
		return;
	}
	user = loaded;
	await loadPhotos();
});
</script>

<svelte:head>
	<title>My profile</title>
</svelte:head>

<main class="profile">
	{#if !user}
		<p class="empty">Loading…</p>
	{:else}
		<header class="head">
			{#if user.image}
				<img class="avatar" src={user.image} alt={user.username} />
			{:else}
				<div class="avatar avatar-initials" aria-hidden="true">{initials(user.username)}</div>
			{/if}

			<div class="meta">
				<h1 class="username">{user.username}</h1>
				<button
					type="button"
					class="email-toggle"
					onclick={() => (showEmail = !showEmail)}
				>
					{showEmail ? user.email : 'Show email'}
				</button>
				{#if !user.emailVerified}
					<!-- Presentation only: the resend lives in Settings. -->
					<a class="verify-badge" href="/settings">Email not verified</a>
				{/if}
			</div>
		</header>

		<dl class="summary">
			<div class="stat">
				<dt>Member since</dt>
				<dd>{memberSince(user.createdAt) || '—'}</dd>
			</div>
			<div class="stat">
				<dt>Photos saved</dt>
				<dd>{photosLoading || photosFailed ? '—' : photos.length}</dd>
			</div>
			<div class="stat">
				<dt>Signed in with</dt>
				<!-- hasPassword only says a password exists; a password account that
				     later links Google still reads "Email". Fine for a summary. -->
				<dd>{user.hasPassword ? 'Email' : 'Google'}</dd>
			</div>
		</dl>

		<section class="recent">
			<div class="recent-head">
				<h2>Recent photos</h2>
				{#if photos.length > 0}
					<a class="view-all" href="/photos">View all</a>
				{/if}
			</div>

			{#if photosLoading}
				<p class="empty">Loading…</p>
			{:else if photosFailed}
				<p class="empty">Couldn't load your photos.</p>
				<button type="button" class="retry" onclick={loadPhotos}>Retry</button>
			{:else if photos.length === 0}
				<p class="empty">
					No photos yet. Your first one starts in the
					<a href="/photobooth/frame">photobooth</a>.
				</p>
			{:else}
				<div class="grid">
					{#each recent as photo (photo.id)}
						<figure class="tile">
							{#if photo.displayUrl}
								<img src={photo.displayUrl} alt="Saved photobooth result" loading="lazy" />
							{:else}
								<div class="placeholder">unavailable</div>
							{/if}
						</figure>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	.profile {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 3rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding-bottom: 1.25rem;
	}

	.avatar {
		width: 5.5rem;
		height: 5.5rem;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-2);
		border: 1px solid var(--line-strong);
		flex: none;
	}

	.avatar-initials {
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--ember);
		background: var(--mustard);
	}

	.username {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 700;
	}

	.meta {
		display: grid;
		gap: 0.4rem;
		min-width: 0;
	}

	.email-toggle {
		justify-self: start;
		background: none;
		border: none;
		padding: 0;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.email-toggle:hover {
		color: var(--ember);
	}

	.verify-badge {
		justify-self: start;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--mustard) 30%, transparent);
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.verify-badge:hover {
		color: var(--ember);
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2.5rem;
		margin: 0 0 2rem;
		padding: 1.25rem 0 0;
		border-top: 1px solid var(--line);
	}

	.stat {
		margin: 0;
		min-width: 0;
	}

	.stat dt {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.stat dd {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.recent-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.recent-head h2 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.view-all {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
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

	.empty {
		color: var(--ink-soft);
	}

	.retry {
		background: var(--dev-bg);
		color: var(--dev-ink);
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
		font-size: var(--text-base);
		margin-top: 1rem;
	}

	.retry:hover {
		background: var(--ink);
	}

	@media (min-width: 560px) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 0.5rem;
		}
	}
</style>
