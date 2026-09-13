<script lang="ts">
import { goto } from "$app/navigation";
import { ApiError } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import Avatar from "$lib/components/Avatar.svelte";
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
import Lightbox from "$lib/components/Lightbox.svelte";
import { PhotoCollection } from "$lib/photos/collection.svelte";
import PhotoTile from "$lib/photos/PhotoTile.svelte";
import { toastStore } from "$lib/toasts/toasts.svelte";
import type { AuthUser } from "@chewable/shared";
import { onMount } from "svelte";

const RECENT_LIMIT = 8;

let user = $state<AuthUser | null>(null);
const collection = new PhotoCollection();
let lightboxIndex = $state<number | null>(null);

let verifyPending = $state(false);
let verifying = $state(false);

function openViewer(photo: { id: string }) {
	const at = collection.viewerIndex(photo.id);
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
	await collection.load(RECENT_LIMIT);
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
				<dd>{collection.loading || collection.failed ? '—' : collection.photos.length}</dd>
			</div>
		</dl>

		<section class="recent">
			<div class="recent-head">
				<h2>Recent photos</h2>
				{#if collection.photos.length > 0}
					<a class="view-all" href="/photos">View all →</a>
				{/if}
			</div>

			{#if collection.loading}
				<p class="empty">Loading…</p>
			{:else if collection.failed}
				<p class="empty">Couldn't load your photos.</p>
				<button
					type="button"
					class="retry"
					onclick={() => void collection.load(RECENT_LIMIT)}
				>
					Retry
				</button>
			{:else if collection.photos.length === 0}
				<div class="empty-state">
					<h2>No photos yet</h2>
					<p>Your first one starts in the photobooth.</p>
					<a class="cta" href="/photobooth/frame">Take a photo</a>
				</div>
			{:else}
				<div class="grid">
					{#each collection.photos as photo (photo.id)}
						<PhotoTile
							{photo}
							label={photoDate(photo.createdAt)}
							zoom
							onOpen={() => openViewer(photo)}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>

{#if lightboxIndex !== null}
	<Lightbox
		photos={collection.viewable}
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
		font-family: var(--font-ui);
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
		font-family: var(--font-ui);
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
		font-family: var(--font-ui);
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
		align-items: start;
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
		font-family: var(--font-ui);
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
