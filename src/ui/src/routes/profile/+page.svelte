<script lang="ts">
import { goto } from "$app/navigation";
import { ApiError, api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import Avatar from "$lib/components/Avatar.svelte";
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
import Lightbox from "$lib/components/Lightbox.svelte";
import { frameAspectRatio } from "$lib/frames/frames";
import { toastStore } from "$lib/toasts/toasts.svelte";
import type { AuthUser, SavedPhoto } from "@chewable/shared";
import { onMount } from "svelte";

type DisplayPhoto = SavedPhoto & { displayUrl?: string };

// The profile is a teaser for /photos, not a second copy of the gallery: it
// signs URLs for the newest few only. Eight also fills two clean rows at the
// widest breakpoint (4 across).
const RECENT_LIMIT = 8;

// Snapshot of the authenticated user for the template, so Svelte can narrow
// it inside the `{:else}` branch after the auth gate.
let user = $state<AuthUser | null>(null);
let photos = $state<DisplayPhoto[]>([]);
// Only the newest few photos get a signed URL, so this stays a teaser of the
// gallery at /photos rather than a second copy of it.
let recent = $state<DisplayPhoto[]>([]);
let photosLoading = $state(true);
let photosFailed = $state(false);
// Index into `viewable`, or null while the viewer is closed.
let lightboxIndex = $state<number | null>(null);

// Resending verification confirms first, matching the same action in Settings.
let verifyPending = $state(false);
let verifying = $state(false);

// The viewer walks only the signed photos, which on this page is the recent
// strip: the full set stays a click away in the gallery.
const viewable = $derived(
	recent
		.filter((p): p is DisplayPhoto & { displayUrl: string } =>
			Boolean(p.displayUrl),
		)
		.map((p) => ({ id: p.id, url: p.displayUrl })),
);

function openViewer(photo: DisplayPhoto) {
	const at = viewable.findIndex((p) => p.id === photo.id);
	if (at !== -1) lightboxIndex = at;
}

function memberSince(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function photoDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString();
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

async function sendVerification() {
	if (verifying) return;
	verifying = true;
	try {
		await auth.sendVerificationEmail();
		toastStore.success("Verification email sent. Check your inbox.");
		verifyPending = false;
	} catch (e) {
		toastStore.error(
			e instanceof ApiError ? e.message : "Could not send the email. Please retry.",
		);
	} finally {
		verifying = false;
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

<main class="profile" inert={lightboxIndex !== null || verifyPending}>
	{#if !user}
		<p class="empty">Loading…</p>
	{:else}
		<header class="head">
			<Avatar
				image={user.image}
				username={user.username}
				size="5.5rem"
				initialsSize="var(--text-2xl)"
			/>

			<div class="identity">
				<h1 class="username">{user.username}</h1>
				<p class="email">{user.email}</p>
				{#if !user.emailVerified}
					<!-- A quiet status line with a real action beside it: the
					     mutation itself goes through the confirm dialog below. -->
					<p class="verify">
						<span>Email not verified</span>
						<button
							type="button"
							class="verify-action"
							onclick={() => (verifyPending = true)}
						>
							Verify email
						</button>
					</p>
				{/if}
			</div>

			<a class="manage" href="/settings">Manage account</a>
		</header>

		<p class="meta">
			Member since {memberSince(user.createdAt) || '—'} · Signed in with {user.hasPassword
				? 'Email'
				: 'Google'}
		</p>

		<dl class="stats">
			<div class="stat">
				<dt>Photos</dt>
				<dd>{photosLoading || photosFailed ? '—' : photos.length}</dd>
			</div>
		</dl>

		<section class="recent">
			<div class="recent-head">
				<h2>Recent photos</h2>
				{#if photos.length > 0}
					<a class="view-all" href="/photos">View all →</a>
				{/if}
			</div>

			{#if photosLoading}
				<p class="empty">Loading…</p>
			{:else if photosFailed}
				<p class="empty">Couldn't load your photos.</p>
				<button type="button" class="retry" onclick={loadPhotos}>Retry</button>
			{:else if photos.length === 0}
				<div class="empty-state">
					<h2>No photos yet</h2>
					<p>Your first one starts in the photobooth.</p>
					<a class="cta" href="/photobooth/frame">Take a photo</a>
				</div>
			{:else}
				<div class="grid">
					{#each recent as photo (photo.id)}
						<figure class="tile" style:aspect-ratio={frameAspectRatio(photo.frame)}>
							<button
								type="button"
								class="open"
								aria-label={`View the photo from ${photoDate(photo.createdAt)}`}
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
						</figure>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>

{#if lightboxIndex !== null}
	<Lightbox
		photos={viewable}
		index={lightboxIndex}
		onClose={() => (lightboxIndex = null)}
	/>
{/if}

{#if verifyPending}
	<ConfirmDialog
		open
		title="Send a verification email?"
		confirmLabel="Send email"
		busyLabel="Sending…"
		busy={verifying}
		onConfirm={() => void sendVerification()}
		onCancel={() => (verifyPending = false)}
	>
		<p>We'll email a fresh verification link to {user?.email}.</p>
	</ConfirmDialog>
{/if}

<style>
	.profile {
		max-width: 72rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 3rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}

	.head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		column-gap: 1.5rem;
		row-gap: 1rem;
	}

	.identity {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
		flex: 1 1 16rem;
	}

	.username {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 700;
	}

	.email {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	/* A quiet status line with a real action beside it, rather than a loud
	   badge that reads as decoration. */
	.verify {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.15rem 0 0;
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}

	.verify-action {
		background: none;
		border: none;
		padding: 0;
		color: var(--ember);
		font-family: inherit;
		font-size: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.verify-action:hover {
		color: var(--ember-deep);
	}

	.manage {
		padding: 0.6rem 1.2rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.5rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.manage:hover {
		border-color: var(--ember);
		color: var(--ember);
	}

	.meta {
		margin: 1rem 0 0;
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}

	.stats {
		margin: 1.5rem 0 2rem;
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
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--ink);
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
		text-decoration: none;
	}

	.view-all:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		/* Keeps each tile at its own ratio instead of stretching it to the row. */
		align-items: start;
	}

	.tile {
		position: relative;
		margin: 0;
		background: var(--surface-2);
		border-radius: 0.75rem;
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

	.open:hover img {
		transform: scale(1.03);
	}

	.placeholder {
		display: grid;
		place-items: center;
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}

	/* Same frame chip as the gallery, so a tile reads the same in both places.
	   Sits above the button; pointer-events keeps it from eating the click. */
	.frame-label {
		position: absolute;
		left: 0.5rem;
		bottom: 0.5rem;
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

	.empty {
		color: var(--ink-soft);
	}

	.empty-state {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 3rem 1.5rem;
		border: 1px dashed var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		text-align: center;
	}

	.empty-state h2 {
		margin: 0;
		font-size: var(--text-xl);
	}

	.empty-state p {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	.cta {
		margin-top: 0.75rem;
		padding: 0.7rem 1.3rem;
		border-radius: 0.5rem;
		background: var(--ember);
		color: #fff;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	.cta:hover {
		background: var(--ember-deep);
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

	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
		/* Inline-end on wider screens; left-aligned when it wraps below. */
		.manage {
			margin-left: auto;
		}
	}

	@media (min-width: 960px) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	@media (pointer: coarse) {
		.manage,
		.cta {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
		.verify-action {
			padding-block: 0.4rem;
		}
	}
</style>
