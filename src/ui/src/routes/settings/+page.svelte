<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth/store.svelte';

	onMount(async () => {
		const loaded = await auth.ensureSession();
		if (!loaded) goto('/login');
	});
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<main class="settings">
	<h1>Settings</h1>
	<p class="empty">Coming soon.</p>
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
		margin: 0 0 0.5rem;
		font-size: var(--text-2xl);
	}

	.empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}
</style>