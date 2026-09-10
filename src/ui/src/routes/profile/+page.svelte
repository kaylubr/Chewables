<script lang="ts">
import { goto } from "$app/navigation";
import { auth } from "$lib/auth/store.svelte";
import { onMount } from "svelte";

let showEmail = $state(false);
// Snapshot of the authenticated user for the template, so Svelte can narrow
// it inside the `{:else}` branch after the auth gate.
let user = $state<import("@chewable/shared").AuthUser | null>(null);

function initials(username: string): string {
	return username.trim().slice(0, 2).toUpperCase() || "?";
}

onMount(async () => {
	const loaded = await auth.ensureSession();
	if (!loaded) {
		goto("/login");
		return;
	}
	user = loaded;
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

	.empty {
		color: var(--ink-soft);
	}
</style>