<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { toastStore } from '$lib/toasts/toasts.svelte';

	let prefersReduced = $state(false);

	const motion = $derived(
		prefersReduced
			? { y: 0, flyMs: 0, fadeMs: 0 }
			: { y: 10, flyMs: 220, fadeMs: 160 }
	);

	onMount(() => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onReduced = () => {
			prefersReduced = reduced.matches;
		};
		onReduced();
		reduced.addEventListener('change', onReduced);
		return () => reduced.removeEventListener('change', onReduced);
	});
</script>

<div class="toast-region">
	{#each toastStore.toasts as t (t.id)}
		<div
			class="toast"
			class:success={t.kind === 'success'}
			class:error={t.kind === 'error'}
			role={t.kind === 'error' ? 'alert' : 'status'}
			in:fly={{ y: motion.y, duration: motion.flyMs }}
			out:fade={{ duration: motion.fadeMs }}
		>
			<p class="msg">{t.message}</p>
			<button
				type="button"
				class="close"
				aria-label="Dismiss notification"
				onclick={() => toastStore.dismiss(t.id)}
			>
				<span class="close-icon" aria-hidden="true"></span>
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-region {
		position: fixed;
		right: calc(1rem + env(safe-area-inset-right));
		bottom: calc(1rem + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.6rem;
		z-index: 80;
		pointer-events: none;
		max-width: min(24rem, calc(100vw - 2rem));
	}
	.toast {
		box-sizing: border-box;
		pointer-events: auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		width: min(24rem, calc(100vw - 2rem));
		max-width: 100%;
		padding: 0.9rem 1rem 0.9rem 1.25rem;
		border-radius: 0.6rem;
		color: #fff;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.28);
		font-family: var(--font-ui);
		font-size: var(--text-lg);
		font-weight: 700;
		line-height: 1.4;
	}
	.toast.success {
		background: var(--success);
	}
	.toast.error {
		background: var(--danger);
	}
	.msg {
		margin: 0;
	}
	.close {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.45rem;
		margin-right: -0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		opacity: 0.9;
	}
	.close:hover {
		opacity: 1;
	}
	.close-icon,
	.close-icon::before {
		display: block;
		width: 1.05rem;
		height: 2.5px;
		background: currentColor;
		border-radius: 2px;
	}
	.close-icon {
		position: relative;
		transform: rotate(45deg);
	}
	.close-icon::before {
		content: '';
		position: absolute;
		left: 0;
		transform: rotate(90deg);
	}
</style>
