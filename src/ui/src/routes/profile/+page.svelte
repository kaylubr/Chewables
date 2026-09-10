<script lang="ts">
import { goto } from "$app/navigation";
import { ApiError, api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import { toastStore } from "$lib/toasts/toasts.svelte";
import type { SavedPhoto } from "@chewable/shared";
import { onMount } from "svelte";

type DisplayPhoto = SavedPhoto & { displayUrl?: string };

let photos = $state<DisplayPhoto[]>([]);
let loading = $state(true);
let loadFailed = $state(false);
let deleting = $state<string | null>(null);
let resending = $state(false);
let showEmail = $state(false);
// Snapshot of the authenticated user for the template, so Svelte can narrow
// it inside the `{:else}` branch after the auth gate.
let user = $state<import("@chewable/shared").AuthUser | null>(null);

function initials(username: string): string {
	return username.trim().slice(0, 2).toUpperCase() || "?";
}

async function resendVerification() {
	if (resending) return;
	resending = true;
	try {
		await auth.sendVerificationEmail();
		toastStore.success("Verification email sent. Check your inbox.");
	} catch (e) {
		toastStore.error(
			e instanceof ApiError
				? e.message
				: "Could not send the email. Please retry.",
		);
	} finally {
		resending = false;
	}
}

async function load() {
	loadFailed = false;
	const loaded = await auth.ensureSession();
	if (!loaded) {
		goto("/login");
		return;
	}
	user = loaded;
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

async function remove(id: string) {
	if (!auth.isAuthenticated) return;
	deleting = id;
	try {
		await api.deletePhoto(id);
		photos = photos.filter((p) => p.id !== id);
		toastStore.success("Photo deleted.");
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
			</div>
		</header>

		<section class="grid" aria-label="Your photos">
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
							onclick={() => void remove(photo.id)}
							disabled={deleting === photo.id}
						>
							{deleting === photo.id ? '…' : '×'}
						</button>
					</figure>
				{/each}
			{/if}
		</section>

	{#if !user.emailVerified}
			<section class="verify" role="status">
				<p>Verify your email to let Google sign-in link to your account.</p>
				<button type="button" class="primary" onclick={resendVerification} disabled={resending}>
					{resending ? 'Sending…' : 'Verify email'}
				</button>
			</section>
		{/if}
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
		padding-bottom: 1.5rem;
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
		background: color-mix(in srgb, var(--mustard) 40%, var(--surface));
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
		font-size: 1.15rem;
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

	.verify {
		margin-top: 2rem;
		padding: 1.25rem 1.25rem 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface-2);
		color: var(--ink);
		display: grid;
		justify-items: start;
		gap: 0.75rem;
	}

	.verify p {
		margin: 0;
		font-size: var(--text-sm);
	}

	.primary {
		background: var(--ember);
		color: #fff;
		border: none;
		border-radius: 0.5rem;
		padding: 0.65rem 1.4rem;
		font-family: var(--font-mono);
		font-size: var(--text-base);
		font-weight: 650;
		cursor: pointer;
	}

	.primary:hover {
		background: var(--ember-deep);
	}

	.primary:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.empty {
		color: var(--ink-soft);
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
			width: 2.5rem;
			height: 2.5rem;
			font-size: 1.5rem;
		}
	}
</style>