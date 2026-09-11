<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		...rest
	}: { value?: string } & Omit<HTMLInputAttributes, 'value' | 'type'> = $props();

	let visible = $state(false);
</script>

<div class="password-field">
	<input {...rest} type={visible ? 'text' : 'password'} bind:value />
	<button
		type="button"
		class="toggle"
		onclick={() => (visible = !visible)}
		aria-label={visible ? 'Hide password' : 'Show password'}
		aria-pressed={visible}
	>
		{#if visible}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<!-- Icon from Lucide - https://github.com/lucide-icons/lucide/blob/main/LICENSE -->
				<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49" />
				<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
				<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143" />
				<path d="m2 2 20 20" />
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<!-- Icon from Lucide - https://github.com/lucide-icons/lucide/blob/main/LICENSE -->
				<path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		{/if}
	</button>
</div>

<style>
	.password-field {
		position: relative;
		display: block;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 2.5rem 0.6rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.5rem;
		font-size: var(--text-base);
		font-weight: 400;
		background: var(--surface);
		color: var(--ink);
	}

	input:focus {
		border-color: var(--ember);
	}

	.toggle {
		position: absolute;
		top: 50%;
		right: 0.4rem;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		padding: 0.3rem;
		border: none;
		border-radius: 0.35rem;
		background: none;
		color: var(--ink-faint);
		cursor: pointer;
	}

	.toggle:hover {
		color: var(--ember);
	}

	@media (pointer: coarse) {
		input {
			padding-block: 0.8rem;
			font-size: 1rem;
		}
		.toggle {
			padding: 0.5rem;
		}
	}
</style>
