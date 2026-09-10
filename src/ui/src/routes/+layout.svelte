<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import brand from '$lib/assets/brand.svg';
	import favicon from '$lib/assets/favicon.svg';
	import { api, ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import ToastRegion from '$lib/toasts/ToastRegion.svelte';
	import { toastStore } from '$lib/toasts/toasts.svelte';
	import "$lib/css/fonts.css"
	
	let { children } = $props();
	let drawerOpen = $state(false);

	function closeDrawer() {
		drawerOpen = false;
	}

	onMount(() => {
		const wide = window.matchMedia('(min-width: 761px)');
		const onWide = (event: MediaQueryListEvent) => {
			if (event.matches) closeDrawer();
		};
		wide.addEventListener('change', onWide);
		return () => wide.removeEventListener('change', onWide);
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeDrawer();
	}

	async function signOut() {
		closeDrawer();
		try {
			await api.logout();
			auth.clear();
			toastStore.success('Signed out.');
			goto('/');
		} catch (e) {
			toastStore.error(e instanceof ApiError ? e.message : 'Could not sign out. Please retry.');
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="topbar">
	<div class="bar-inner">
		<a href="/" class="brand">
			<img class="brand-mark" src={brand} alt="Chewables home" />
		</a>
		<div class="bar-right">
			<nav>
				<a href="/photobooth/frame">Photobooth</a>
				<a href="/#faq">FAQ</a>
				<a href="/#about">About</a>
				{#if auth.isAuthenticated}
					<a href="/profile">My profile</a>
					<button type="button" class="link" onclick={signOut}>Sign out</button>
				{:else}
					<a href="/login">Sign in</a>
				{/if}
			</nav>
			<button
				type="button"
				class="menu-toggle"
				aria-expanded={drawerOpen}
				aria-controls="site-drawer"
				aria-label="Menu"
				onclick={() => (drawerOpen = !drawerOpen)}
			>
				<span class="menu-icon" aria-hidden="true"></span>
			</button>
		</div>
	</div>
</header>

<button
	type="button"
	class="scrim"
	class:open={drawerOpen}
	aria-label="Close menu"
	tabindex={drawerOpen ? 0 : -1}
	onclick={closeDrawer}
></button>

<div class="drawer" id="site-drawer" class:open={drawerOpen} aria-hidden={!drawerOpen}>
	<div class="drawer-header">
		<button
			type="button"
			class="drawer-close"
			aria-label="Close menu"
			onclick={closeDrawer}
		>
			<span class="close-icon" aria-hidden="true"></span>
		</button>
	</div>
	<nav class="drawer-nav">
		<a href="/" onclick={closeDrawer}>Home</a>
		<a href="/photobooth/frame" onclick={closeDrawer}>Photobooth</a>
		<a href="/#faq" onclick={closeDrawer}>FAQ</a>
		<a href="/#about" onclick={closeDrawer}>About</a>
		{#if auth.isAuthenticated}
			<a href="/profile" onclick={closeDrawer}>My profile</a>
			<button type="button" class="link" onclick={signOut}>Sign out</button>
		{:else}
			<a href="/login" onclick={closeDrawer}>Sign in</a>
		{/if}
	</nav>
</div>

<ToastRegion />

{@render children()}

<svelte:window onkeydown={handleKeydown} />

<style>
	:global(:focus-visible) {
		outline: 2px solid var(--mustard);
		outline-offset: 2px;
	}
	:global(html) {
		--crimson: #c31b1b;
		--crimson-deep: #9e1212;
		--mustard: #f5c400;
		--mustard-deep: #d9ad00;
		--paper: #fafafa;
		--surface: #ffffff;
		--surface-2: #f4f4f4;
		--charcoal: #1a1a1a;
		--ink-soft: #444444;
		--ink-faint: #8a8a8a;
		--line: #e5e5e5;
		--line-strong: #c9c9c9;

		--danger: #b3261e;
		--danger-bg: #fce9e7;
		--danger-line: #f0c4c0;
		--success: #1e7d32;
		--focus: var(--mustard);

		--stage: #14100c;
		--stage-raise: #221b15;
		--stage-ink: #f5f1ea;
		--stage-ink-soft: #cfc4b8;
		--stage-line: #3a3028;

		--font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
		--font-ui: 'Philosopher', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		--font-mono: 'Lustria', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

		--text-xs: 0.75rem;
		--text-sm: 0.875rem;
		--text-base: 1rem;
		--text-lg: 1.125rem;
		--text-xl: 1.375rem;
		--text-2xl: 1.75rem;
		--text-3xl: 2.25rem;

		--ink: var(--charcoal);
		--ember: var(--crimson);
		--ember-deep: var(--crimson-deep);
		--ember-ink: var(--crimson);
		--dev-bg: var(--stage);
		--dev-bg-raise: var(--stage-raise);
		--dev-ink: var(--stage-ink);
		--dev-ink-soft: var(--stage-ink-soft);
		--dev-line: var(--stage-line);

		font-family: var(--font-ui);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}
	:global(body) {
		font-size: var(--text-base);
		line-height: 1.6;
		color: var(--charcoal);
		background: var(--paper);
		margin: 0;
	}
	:global(h1, h2, h3) {
		font-family: var(--font-display);
		font-optical-sizing: auto;
		text-wrap: balance;
		color: var(--charcoal);
	}
	:global(p) {
		text-wrap: pretty;
	}
	:global(input, textarea) {
		font: inherit;
	}
	:global(button) {
		font-family: var(--font-mono);
	}
	:global(::selection) {
		background: color-mix(in srgb, var(--mustard) 40%, transparent);
	}
	:global(a) {
		color: var(--crimson);
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}
	:global(a:hover) {
		color: var(--crimson-deep);
	}
	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		background: var(--crimson);
		color: #fff;
		padding: 0.45rem 0.8rem;
	}
	.bar-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: calc(0.3rem + env(safe-area-inset-top)) 1.5rem 0.3rem;
		max-width: 76rem;
		margin: 0 auto;
	}
	.bar-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
	.brand-mark {
		display: block;
		height: clamp(3.6rem, 2.45rem + 2vw, 5.25rem);
		width: auto;
	}
	.brand:hover .brand-mark {
		opacity: 0.9;
	}
	nav {
		display: flex;
		gap: 1.5rem;
		align-items: center;
	}
	nav a,
	.link {
		font-family: var(--font-mono);
		font-size: clamp(0.68rem, 0.4rem + 0.55vw, 0.95rem);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mustard);
		text-decoration: none;
		font-weight: bolder;
		background: none;
		border: none;
		padding: 0.5rem 0.2rem;
		cursor: pointer;
		border-radius: 0.25rem;
	}
	nav a:hover,
	.link:hover {
		color: #fff;
	}
	.menu-toggle {
		display: none;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.6rem;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.menu-icon,
	.menu-icon::before,
	.menu-icon::after {
		display: block;
		width: 1.4rem;
		height: 2px;
		background: currentColor;
		border-radius: 1px;
	}
	.menu-icon {
		position: relative;
	}
	.menu-icon::before,
	.menu-icon::after {
		content: '';
		position: absolute;
		left: 0;
	}
	.menu-icon::before {
		top: -0.42rem;
	}
	.menu-icon::after {
		top: 0.42rem;
	}
	.menu-toggle[aria-expanded='true'] .menu-icon {
		background: transparent;
	}
	.menu-toggle[aria-expanded='true'] .menu-icon::before {
		top: 0;
		transform: rotate(45deg);
	}
	.menu-toggle[aria-expanded='true'] .menu-icon::after {
		top: 0;
		transform: rotate(-45deg);
	}
	.scrim {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.45);
		border: none;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
		z-index: 40;
	}
	.scrim.open {
		opacity: 1;
		pointer-events: auto;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(19rem, 85vw);
		background: var(--surface);
		box-shadow: -12px 0 32px rgb(0 0 0 / 0.2);
		transform: translateX(100%);
		transition: transform 0.25s ease;
		z-index: 50;
		padding: calc(1.2rem + env(safe-area-inset-top)) 1.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}
	.drawer.open {
		transform: translateX(0);
	}
	.drawer-header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 0.25rem;
	}
	.drawer-close {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		color: var(--charcoal);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.close-icon,
	.close-icon::before {
		display: block;
		width: 1.15rem;
		height: 2px;
		background: currentColor;
		border-radius: 1px;
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
	.drawer-close:hover {
		color: var(--crimson);
	}
	.drawer-nav {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
	}
	.drawer-nav a,
	.drawer-nav .link {
		font-family: var(--font-mono);
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--charcoal);
		text-decoration: none;
		padding: 0.9rem 0.4rem;
		border-radius: 0.4rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.drawer-nav a:hover,
	.drawer-nav .link:hover {
		color: var(--crimson);
		background: var(--surface-2);
	}
	@media (max-width: 760px) {
		nav {
			display: none;
		}
		.menu-toggle {
			display: inline-flex;
		}
		.bar-inner {
			padding-inline: 1rem;
		}
		.brand-mark {
			height: 2rem;
		}
	}
	@media (pointer: coarse) {
		nav a,
		.link {
			padding-block: 0.65rem;
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}
</style>
