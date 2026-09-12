<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';

	/**
	 * Error page for an unknown route, or for anything a load or entry throws.
	 *
	 * There is no SSR — production serves the SPA shell through Express (ADR
	 * 0010) — so this always renders on the client. The status is shown either
	 * way; the underlying message is dev-only, and SvelteKit already
	 * genericises 5xx messages in production.
	 */
	const notFound = $derived(page.status === 404);
	const retryable = $derived(page.status >= 500);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<p class="status">{page.status}</p>
	<h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="body">
		{notFound
			? "That page doesn't exist. It may have moved, or the link may be wrong."
			: "That's on us, not you. Try again in a moment."}
	</p>

	{#if dev}
		<p class="detail">{page.error?.message}</p>
	{/if}

	<div class="actions">
		<a class="primary" href="/">Back to home</a>
		<a class="secondary" href="/report">Report an issue</a>
		{#if retryable}
			<button type="button" class="secondary" onclick={() => location.reload()}>
				Try again
			</button>
		{/if}
	</div>
</main>

<style>
	.error-page {
		max-width: 40rem;
		margin: 0 auto;
		/* Fills the space under the sticky header so the block centres in the
		   viewport rather than sitting at the top. `safe` keeps the content
		   reachable when it is taller than a short viewport. */
		min-height: calc(100dvh - 6rem);
		padding: 2rem 1.5rem;
		display: grid;
		place-content: center;
		place-content: safe center;
		justify-items: center;
		gap: 0.5rem;
		text-align: center;
		font-family: var(--font-ui);
		color: var(--ink);
	}

	.status {
		margin: 0;
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.error-page h1 {
		margin: 0;
		font-size: var(--text-xl);
	}

	.body {
		margin: 0;
		max-width: var(--measure);
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	.detail {
		margin: 0;
		max-width: var(--measure);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		color: var(--ink-faint);
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
		margin-top: 0.75rem;
	}

	.primary,
	.secondary {
		padding: 0.7rem 1.3rem;
		border-radius: 0.5rem;
		font-family: var(--font-ui);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	.primary {
		background: var(--ember);
		color: #fff;
		border: none;
	}

	.primary:hover {
		background: var(--ember-deep);
	}

	.secondary {
		background: none;
		border: 1px solid var(--line-strong);
		color: var(--ink);
	}

	.secondary:hover {
		border-color: var(--ember);
		color: var(--ember);
	}

	@media (pointer: coarse) {
		.primary,
		.secondary {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
	}
</style>
