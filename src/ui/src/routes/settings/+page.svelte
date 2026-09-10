<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import { toastStore } from '$lib/toasts/toasts.svelte';

	let resending = $state(false);
	let user = $state<import('@chewable/shared').AuthUser | null>(null);

	async function resendVerification() {
		if (resending) return;
		resending = true;
		try {
			await auth.sendVerificationEmail();
			toastStore.success('Verification email sent. Check your inbox.');
		} catch (e) {
			toastStore.error(e instanceof ApiError ? e.message : 'Could not send the email. Please retry.');
		} finally {
			resending = false;
		}
	}

	onMount(async () => {
		const loaded = await auth.ensureSession();
		if (!loaded) {
			goto('/login');
			return;
		}
		user = loaded;
	});
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<main class="settings">
	<h1>Settings</h1>

	{#if user && !user.emailVerified}
		<section class="verify" role="status">
			<p>Verify your email to let Google sign-in link to your account.</p>
			<button type="button" class="primary" onclick={resendVerification} disabled={resending}>
				{resending ? 'Sending…' : 'Verify email'}
			</button>
		</section>
	{/if}

	<p class="empty">More settings coming soon.</p>
</main>

<style>
	.settings {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 4rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}

	.settings h1 {
		margin: 0 0 1rem;
		font-size: var(--text-2xl);
	}

	.verify {
		padding: 1.25rem 1.25rem 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface-2);
		color: var(--ink);
		display: grid;
		justify-items: start;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
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
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}
</style>