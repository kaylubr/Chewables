<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth/store.svelte';

	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			await auth.ensureSession();
		} catch {
			error = 'Sign-in did not complete. Please try again.';
			return;
		}
		const next = new URLSearchParams(window.location.search).get('next');
		goto(next && next.startsWith('/') ? next : '/photos', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Signing you in — Chewables</title>
</svelte:head>

<main class="callback-page">
	{#if error}
		<p class="error" role="alert">{error}</p>
		<p><a href="/login">Back to sign in</a></p>
	{:else}
		<p>Signing you in…</p>
	{/if}
</main>

<style>
	.callback-page {
		max-width: 24rem;
		margin: 0 auto;
		padding: 3rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
		text-align: center;
	}
	.error {
		color: var(--danger);
		background: var(--danger-bg);
		border: 1px solid var(--danger-line);
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		font-size: var(--text-sm);
	}
</style>