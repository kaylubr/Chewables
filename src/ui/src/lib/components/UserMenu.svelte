<script lang="ts">
	import type { AuthUser } from '@chewable/shared';
	import Avatar from './Avatar.svelte';

	/**
	 * Account menu: the profile photo as a button that opens Profile / Settings /
	 * Log out. Closes on outside click, Escape (focus returns to the trigger), and
	 * after choosing an item.
	 */
	let { user, onSignOut }: { user: AuthUser; onSignOut: () => void } = $props();

	let open = $state(false);
	let container: HTMLElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();

	function menuItems(): HTMLElement[] {
		return panel ? Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
	}

	function toggle() {
		open = !open;
		if (open) queueMicrotask(() => menuItems()[0]?.focus());
	}

	function close(focusTrigger = false) {
		open = false;
		if (focusTrigger) trigger?.focus();
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close(true);
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = menuItems();
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLElement);
		const delta = event.key === 'ArrowDown' ? 1 : -1;
		items[(index + delta + items.length) % items.length]?.focus();
	}

	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (container && !container.contains(event.target as Node)) open = false;
		};
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});
</script>

<div class="user-menu" bind:this={container}>
	<button
		type="button"
		class="trigger"
		class:open
		bind:this={trigger}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Account menu"
		onclick={toggle}
	>
		<Avatar image={user.image} username={user.username} size="3rem" />
	</button>

	{#if open}
		<div class="panel" role="menu" aria-label="Account" bind:this={panel}>
			<a href="/profile" role="menuitem" onclick={() => close()}>Profile</a>
			<a href="/settings" role="menuitem" onclick={() => close()}>Settings</a>
			<button
				type="button"
				role="menuitem"
				class="logout"
				onclick={() => {
					close();
					onSignOut();
				}}
			>
				Log out
			</button>
		</div>
	{/if}
</div>

<svelte:window onkeydown={onMenuKeydown} />

<style>
	.user-menu {
		position: relative;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem;
		background: none;
		border: 2px solid transparent;
		border-radius: 50%;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.trigger:hover,
	.trigger.open {
		border-color: var(--mustard);
	}

	.panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		min-width: 11rem;
		padding: 0.35rem;
		display: grid;
		gap: 0.1rem;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: 0.6rem;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.25);
		z-index: 60;
	}

	.panel a,
	.panel .logout {
		display: block;
		padding: 0.55rem 0.75rem;
		border: none;
		border-radius: 0.4rem;
		background: none;
		color: var(--charcoal);
		font-family: var(--font-ui);
		font-size: var(--text-sm);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.panel a:hover,
	.panel .logout:hover,
	.panel a:focus-visible,
	.panel .logout:focus-visible {
		background: var(--surface-2);
		color: var(--ember);
	}

	.panel .logout {
		border-top: 1px solid var(--line);
		border-radius: 0 0 0.4rem 0.4rem;
		margin-top: 0.1rem;
	}
</style>