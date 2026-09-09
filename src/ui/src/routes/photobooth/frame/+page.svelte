<script lang="ts">
	import { goto } from '$app/navigation';
	import { FRAMES } from '$lib/frames/frames';
	import type { FrameId } from '$lib/frames/types';
	import { booth } from '$lib/photobooth/store.svelte';

	let selected = $state<FrameId | null>(null);
	let error = $state<string | null>(null);

	function choose(id: FrameId) {
		selected = id;
		error = null;
	}

	function start() {
		if (!selected) {
			error = 'Pick a frame first.';
			return;
		}
		booth.selectFrame(selected);
		booth.session.state = 'requesting-camera';
		goto('/photobooth/camera');
	}
</script>

<svelte:head>
	<title>Choose a frame</title>
</svelte:head>

<main class="frame-page">
	<h1>Choose a frame</h1>
	<p class="sub">Your photos will sit inside the frame's openings.</p>

	<div class="grid">
		{#each FRAMES as frame}
			<button
				type="button"
				class="frame-card"
				class:selected={selected === frame.id}
				aria-pressed={selected === frame.id}
				onclick={() => choose(frame.id)}
			>
				<img src={frame.image} alt={`${frame.name} frame preview`} width="220" />
				<span class="card-meta">
					<span class="name">{frame.name}</span>
					<span class="count">{frame.photoCount} photos</span>
				</span>
			</button>
		{/each}
	</div>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<div class="actions">
		<button type="button" class="primary" onclick={start}>Use this frame →</button>
	</div>
</main>

<style>
	.frame-page {
		max-width: 60rem;
		margin: 0 auto;
		padding: 3rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}
	.sub {
		color: var(--ink-soft);
		margin-top: -0.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1.25rem;
		margin: 2rem 0;
	}
	.frame-card {
		border: 2px solid var(--line);
		border-radius: 0.75rem;
		background: var(--surface);
		padding: 1rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.frame-card:hover {
		border-color: var(--line-strong);
	}
	.frame-card.selected {
		border-color: var(--ember);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--ember) 25%, transparent);
	}
	.frame-card img {
		border-radius: 0.35rem;
		max-height: 240px;
		object-fit: contain;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 640;
		font-size: var(--text-lg);
	}
	.count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.error {
		color: var(--danger);
		font-weight: 600;
	}
	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	.primary {
		background: var(--ember);
		color: #fff;
		border: none;
		border-radius: 0.5rem;
		padding: 0.7rem 1.4rem;
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
	}
	@media (max-width: 480px) {
		.grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
		.frame-card {
			flex-direction: row;
			justify-content: flex-start;
			text-align: left;
			gap: 1rem;
			padding: 0.9rem;
		}
		.frame-card img {
			max-height: 140px;
			max-width: 38%;
			flex: none;
		}
		.frame-card .card-meta {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
		}
		.actions {
			flex-wrap: wrap;
		}
	}
	@media (pointer: coarse) {
		.primary {
			min-height: 48px;
			padding-inline: 1.6rem;
		}
	}
</style>
