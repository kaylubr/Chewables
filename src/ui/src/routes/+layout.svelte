<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import brand from '$lib/assets/brand.svg';
	import favicon from '$lib/assets/favicon.svg';
	import { api, ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ToastRegion from '$lib/toasts/ToastRegion.svelte';
	import { toastStore } from '$lib/toasts/toasts.svelte';
	import "$lib/css/fonts.css"
	
	let { children } = $props();
	let drawerOpen = $state(false);
	let signOutPending = $state(false);
	let signingOut = $state(false);

	function closeDrawer() {
		drawerOpen = false;
	}

	function requestSignOut() {
		closeDrawer();
		signOutPending = true;
	}

	onMount(() => {
		void auth.ensureSession();

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
		signingOut = true;
		try {
			await api.logout();
			auth.clear();
			toastStore.success('Signed out.');
			goto('/');
		} catch (e) {
			toastStore.error(e instanceof ApiError ? e.message : 'Could not sign out. Please retry.');
		} finally {
			signingOut = false;
			signOutPending = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="topbar" inert={signOutPending}>
	<div class="bar-inner">
		<a href="/" class="brand">
			<img class="brand-mark" src={brand} alt="Chewables home" />
		</a>
		<div class="bar-right">
			<nav>
				<a href="/photobooth/frame">Photobooth</a>
				{#if auth.isAuthenticated}
					<a href="/photos">Photos</a>
				{:else}
					<a href="/#faq">FAQ</a>
					<a href="/#about">About</a>
					<a href="/login">Sign in</a>
				{/if}
			</nav>
			{#if auth.user}
				<div class="account">
					<UserMenu user={auth.user} onSignOut={requestSignOut} />
				</div>
			{/if}
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

<div
	class="drawer"
	id="site-drawer"
	class:open={drawerOpen}
	aria-hidden={!drawerOpen}
	inert={signOutPending}
>
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
		{#if auth.isAuthenticated}
			<a href="/photos" onclick={closeDrawer}>Photos</a>
			<a href="/profile" onclick={closeDrawer}>My profile</a>
			<a href="/settings" onclick={closeDrawer}>Settings</a>
			<button type="button" class="link" onclick={requestSignOut}>Sign out</button>
		{:else}
			<a href="/#faq" onclick={closeDrawer}>FAQ</a>
			<a href="/#about" onclick={closeDrawer}>About</a>
			<a href="/login" onclick={closeDrawer}>Sign in</a>
		{/if}
	</nav>
</div>

<ToastRegion />

<div class="page" inert={signOutPending}>
	{@render children()}
</div>

{#if signOutPending}
	<ConfirmDialog
		open
		title="Sign out?"
		confirmLabel="Sign out"
		busyLabel="Signing out…"
		busy={signingOut}
		onConfirm={() => void signOut()}
		onCancel={() => (signOutPending = false)}
	>
		<p>
			You'll need to sign in again to save photos to your account. Anything you've already
			saved stays in your gallery.
		</p>
	</ConfirmDialog>
{/if}

<svelte:window onkeydown={handleKeydown} />

<style>
	:global(:focus-visible) {
		/* Two-tone ring: the charcoal outline reads on light surfaces, the
		   mustard halo reads on the crimson bar. One of the two always clears
		   3:1, so focus is visible wherever it lands. */
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--focus-halo);
	}
	:global(html) {
		/* #a51212 keeps mustard-on-crimson at 4.74:1 (AA for body text) while
		   staying the same crimson lane; the old #c31b1b measured 3.66:1. */
		--crimson: #a51212;
		--crimson-deep: #8f1010;
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
		--focus-ring: var(--charcoal);
		--focus-halo: color-mix(in srgb, var(--mustard) 70%, transparent);
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
		--text-lg: 1.3rem;
		--text-xl: 1.7rem;
		--text-2xl: 2.25rem;
		--text-3xl: 3rem;

		--leading-tight: 1.1;
		--leading-snug: 1.3;
		--leading-normal: 1.55;
		--leading-relaxed: 1.7;
		--measure: 65ch;

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
		line-height: var(--leading-normal);
		color: var(--charcoal);
		background: var(--paper);
		margin: 0;
	}
	:global(h1, h2, h3) {
		font-family: var(--font-display);
		font-optical-sizing: auto;
		line-height: var(--leading-tight);
		text-wrap: balance;
		overflow-wrap: break-word;
		color: var(--charcoal);
	}
	:global(p) {
		text-wrap: pretty;
		overflow-wrap: break-word;
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
	:global(::-webkit-scrollbar) {
		width: 10px;
		height: 10px;
		background: transparent;
	}
	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: var(--ink-faint);
		border-radius: 999px;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: var(--mustard);
	}
	@supports not selector(::-webkit-scrollbar) {
		:global(html) {
			scrollbar-color: var(--ink-faint) transparent;
			scrollbar-width: thin;
		}
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
	.account {
		display: none;
		align-items: center;
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
		font-size: clamp(var(--text-xs), 0.4rem + 0.55vw, var(--text-sm));
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mustard);
		text-decoration: none;
		font-weight: 700;
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
		font-size: var(--text-base);
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
	@media (min-width: 761px) {
		.account {
			display: flex;
		}
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
