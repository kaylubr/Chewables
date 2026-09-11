<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { AuthUser } from '@chewable/shared';
	import Avatar from '$lib/components/Avatar.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { api, ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import { toastStore } from '$lib/toasts/toasts.svelte';

	/**
	 * The action waiting on confirmation. Each one carries what it needs, so the
	 * dialog can describe it and then run it without re-reading the form.
	 */
	type Pending =
		| { kind: 'sign-out' }
		| { kind: 'resend-verification' }
		| { kind: 'change-email'; newEmail: string }
		| { kind: 'change-password'; currentPassword: string; newPassword: string }
		| { kind: 'set-password'; newPassword: string }
		| { kind: 'delete-account' };

	// Snapshot of the session user for the template, so Svelte can narrow it
	// after the auth gate.
	let user = $state<AuthUser | null>(null);
	let pending = $state<Pending | null>(null);
	let running = $state(false);

	// Email
	let newEmail = $state('');

	// Password
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	// Delete account
	let confirmUsername = $state('');
	let deletePassword = $state('');
	let deleteError = $state('');

	const copy = $derived(pending ? describe(pending) : null);

	function describe(action: Pending): {
		title: string;
		confirmLabel: string;
		busyLabel: string;
		destructive: boolean;
		failure: string;
	} {
		switch (action.kind) {
			case 'sign-out':
				return {
					title: 'Sign out?',
					confirmLabel: 'Sign out',
					busyLabel: 'Signing out…',
					destructive: false,
					failure: 'Could not sign out. Please retry.',
				};
			case 'resend-verification':
				return {
					title: 'Send a new verification link?',
					confirmLabel: 'Send link',
					busyLabel: 'Sending…',
					destructive: false,
					failure: 'Could not send the email. Please retry.',
				};
			case 'change-email':
				return {
					title: 'Change your email?',
					confirmLabel: 'Send link',
					busyLabel: 'Sending…',
					destructive: false,
					failure: 'Could not start the email change. Please retry.',
				};
			case 'change-password':
				return {
					title: 'Change your password?',
					confirmLabel: 'Change password',
					busyLabel: 'Changing…',
					destructive: false,
					failure: 'Could not update your password. Please retry.',
				};
			case 'set-password':
				return {
					title: 'Set a password?',
					confirmLabel: 'Set password',
					busyLabel: 'Setting…',
					destructive: false,
					failure: 'Could not set your password. Please retry.',
				};
			case 'delete-account':
				return {
					title: 'Delete your account?',
					confirmLabel: 'Delete account',
					busyLabel: 'Deleting…',
					destructive: true,
					failure: 'Could not delete your account. Please retry.',
				};
		}
	}

	onMount(async () => {
		const loaded = await auth.ensureSession();
		if (!loaded) {
			goto('/login');
			return;
		}
		if (page.url.searchParams.get('email_changed') === '1') {
			await confirmEmailChange();
		}
		user = auth.user;
	});

	/**
	 * The landing page for a confirmed email change. The server decides whether
	 * anything actually completed — a bare visit to this URL is inert — and
	 * drops the user's other sessions when it did.
	 */
	async function confirmEmailChange() {
		try {
			const { changed } = await api.confirmEmailChange();
			await auth.ensureSession();
			if (changed) {
				toastStore.success('Your new email is confirmed.');
			}
		} catch (e) {
			toastStore.error(
				e instanceof ApiError ? e.message : 'Could not confirm your email change.',
			);
		} finally {
			// Drop the query param so a reload doesn't replay the confirmation.
			goto('/settings', { replaceState: true });
		}
	}

	function memberSince(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	function message(e: unknown, fallback: string): string {
		return e instanceof ApiError ? e.message : fallback;
	}

	async function refreshUser() {
		await auth.ensureSession();
		user = auth.user;
	}

	function clearPasswords() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}

	function submitEmailChange() {
		const address = newEmail.trim();
		if (!address) return;
		pending = { kind: 'change-email', newEmail: address };
	}

	function submitPassword() {
		if (newPassword !== confirmPassword) {
			toastStore.error('Passwords do not match.');
			return;
		}
		if (newPassword.length < 8) {
			toastStore.error('Password must be at least 8 characters.');
			return;
		}
		pending = user?.hasPassword
			? { kind: 'change-password', currentPassword, newPassword }
			: { kind: 'set-password', newPassword };
	}

	function submitDelete() {
		deleteError = '';
		if (confirmUsername !== user?.username) {
			deleteError = 'Type your username exactly to confirm.';
			return;
		}
		const hasPassword = user?.hasPassword ?? false;
		if (hasPassword && !deletePassword) {
			deleteError = 'Enter your password to delete this account.';
			return;
		}
		pending = { kind: 'delete-account' };
	}

	async function run() {
		const action = pending;
		if (!action || running) return;
		running = true;
		try {
			switch (action.kind) {
				case 'sign-out':
					await api.logout();
					auth.clear();
					toastStore.success('Signed out.');
					goto('/');
					break;
				case 'resend-verification':
					await auth.sendVerificationEmail();
					toastStore.success('Verification email sent. Check your inbox.');
					break;
				case 'change-email':
					await api.changeEmail(action.newEmail);
					newEmail = '';
					// Better Auth answers success even when the address is
					// already taken, and nothing moves until the link is
					// followed — so this can only ask the user to check their
					// inbox.
					toastStore.success('Check your inbox to verify your new email.');
					break;
				case 'change-password':
					await api.changePassword(action.currentPassword, action.newPassword);
					await refreshUser();
					clearPasswords();
					toastStore.success('Password updated.');
					break;
				case 'set-password':
					await api.setPassword(action.newPassword);
					await refreshUser();
					clearPasswords();
					toastStore.success('Password set.');
					break;
				case 'delete-account': {
					const hasPassword = user?.hasPassword ?? false;
					await api.deleteAccount(
						confirmUsername,
						hasPassword ? deletePassword : undefined,
					);
					auth.clear();
					toastStore.success('Your account was deleted.');
					goto('/');
					break;
				}
			}
			pending = null;
		} catch (e) {
			pending = null;
			// Deletion keeps its error beside the fields the user has to fix;
			// everything else has no form on screen to correct.
			if (action.kind === 'delete-account') {
				deleteError = message(e, describe(action).failure);
			} else {
				toastStore.error(message(e, describe(action).failure));
			}
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<main class="settings" inert={pending !== null}>
	<h1>Settings</h1>

	{#if !user}
		<p class="empty">Loading…</p>
	{:else}
		<section class="card">
			<h2>Account</h2>
			<div class="identity">
				<Avatar image={user.image} username={user.username} size="3.5rem" />
				<div class="identity-text">
					<p class="username">{user.username}</p>
					<p class="email">{user.email}</p>
					<p class="since">
						{#if memberSince(user.createdAt)}
							Member since {memberSince(user.createdAt)}
						{:else}
							&nbsp;
						{/if}
					</p>
				</div>
			</div>
			<div class="actions">
				<button
					type="button"
					class="secondary"
					onclick={() => (pending = { kind: 'sign-out' })}
				>
					Sign out
				</button>
			</div>
		</section>

		<section class="card">
			<h2>Email</h2>
			<p class="row">
				<span class="row-value">{user.email}</span>
				{#if user.emailVerified}
					<span class="badge ok">Verified</span>
				{:else}
					<span class="badge warn">Not verified</span>
				{/if}
			</p>
			{#if !user.emailVerified}
				<p class="hint">
					Verify your email to let Google sign-in link to your account.
				</p>
				<div class="actions">
					<button
						type="button"
						class="secondary"
						onclick={() => (pending = { kind: 'resend-verification' })}
					>
						Verify email
					</button>
				</div>
			{/if}

			<form class="stack" onsubmit={(e) => { e.preventDefault(); submitEmailChange(); }}>
				<label>
					New email address
					<input type="email" bind:value={newEmail} required autocomplete="email" />
				</label>
				<button type="submit" class="primary">Change email</button>
			</form>
		</section>

		<section class="card">
			<h2>Password</h2>
			{#if !user.hasPassword}
				<p class="hint">
					You signed up with Google, so this account has no password yet. Setting one
					gives you a way back in without Google.
				</p>
			{/if}
			<form class="stack" onsubmit={(e) => { e.preventDefault(); submitPassword(); }}>
				{#if user.hasPassword}
					<label>
						Current password
						<PasswordInput
							bind:value={currentPassword}
							required
							autocomplete="current-password"
						/>
					</label>
				{/if}
				<label>
					New password
					<PasswordInput
						bind:value={newPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</label>
				<label>
					Confirm new password
					<PasswordInput
						bind:value={confirmPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</label>
				<button type="submit" class="primary">
					{user.hasPassword ? 'Update password' : 'Set password'}
				</button>
			</form>
		</section>

		<section class="card danger">
			<h2>Delete account</h2>
			<p class="hint">
				This permanently deletes your account and every photo saved to it. It cannot be
				undone.
			</p>
			<form class="stack" onsubmit={(e) => { e.preventDefault(); submitDelete(); }}>
				<label>
					TYPE <span class="confirm-token">{user.username}</span> TO CONFIRM
					<input type="text" bind:value={confirmUsername} autocomplete="off" />
				</label>
				{#if user.hasPassword}
					<label>
						Password
						<PasswordInput
							bind:value={deletePassword}
							autocomplete="current-password"
						/>
					</label>
				{/if}
				{#if deleteError}
					<p class="error" role="alert">{deleteError}</p>
				{/if}
				<button type="submit" class="destructive">Delete my account</button>
			</form>
		</section>
	{/if}
</main>

{#if pending && copy}
	<ConfirmDialog
		open
		title={copy.title}
		confirmLabel={copy.confirmLabel}
		busyLabel={copy.busyLabel}
		destructive={copy.destructive}
		busy={running}
		onConfirm={() => void run()}
		onCancel={() => (pending = null)}
	>
		{#if pending.kind === 'sign-out'}
			<p>
				You'll need to sign in again to save photos to your account. Anything you've
				already saved stays in your gallery.
			</p>
		{:else if pending.kind === 'resend-verification'}
			<p>We'll email a fresh verification link to {user?.email}.</p>
		{:else if pending.kind === 'change-email'}
			<p>
				We'll email a confirmation link to {pending.newEmail}. Your address only changes
				once you follow it.
			</p>
		{:else if pending.kind === 'change-password'}
			<p>You'll stay signed in here, but your other devices will be signed out.</p>
		{:else if pending.kind === 'set-password'}
			<p>This adds a password to your account so you can sign in without Google.</p>
		{:else if pending.kind === 'delete-account'}
			<p>
				Your account and every photo saved to it will be deleted for good. This cannot be
				undone.
			</p>
		{/if}
	</ConfirmDialog>
{/if}

<style>
	.settings {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 4rem;
		font-family: var(--font-ui);
		color: var(--ink);
		display: grid;
		gap: 1.5rem;
	}

	.settings h1 {
		margin: 0;
		font-size: var(--text-2xl);
	}

	.settings h2 {
		margin: 0 0 1rem;
		font-size: var(--text-lg);
	}

	.card {
		padding: 1.5rem;
		border-radius: 0.75rem;
		background: var(--surface);
		box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;
	}

	.card.danger {
		border-color: var(--danger-line);
		background: var(--danger-bg);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.identity-text {
		min-width: 0;
	}

	.username {
		margin: 0;
		font-weight: 700;
		font-size: var(--text-lg);
	}

	.email {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.since {
		margin: 0.25rem 0 0;
		color: var(--ink-faint);
		font-size: var(--text-xs);
	}

	.row {
		margin: 0 0 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.row-value {
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.badge {
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.badge.ok {
		background: color-mix(in srgb, var(--success) 12%, transparent);
		color: var(--success);
	}

	.badge.warn {
		background: color-mix(in srgb, var(--mustard) 30%, transparent);
		color: var(--ink-soft);
	}

	.hint {
		margin: 0 0 0.75rem;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* The exact string the user has to type, set apart from the sentence as a
	   literal token. box-decoration-break keeps the chip intact if a long
	   username wraps. */
	.confirm-token {
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--danger-line);
		border-radius: 0.3rem;
		background: var(--surface);
		color: var(--charcoal);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.02em;
		overflow-wrap: anywhere;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.stack {
		display: grid;
		gap: 0.9rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 600;
		font-size: var(--text-sm);
	}

	input {
		padding: 0.6rem 0.75rem;
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

	.primary,
	.secondary,
	.destructive {
		padding: 0.7rem 1.3rem;
		border-radius: 0.5rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		justify-self: start;
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

	.destructive {
		background: var(--danger);
		color: #fff;
		border: none;
	}

	.destructive:hover {
		background: color-mix(in srgb, var(--danger) 85%, black);
	}

	.empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--text-sm);
	}

	@media (pointer: coarse) {
		input {
			padding-block: 0.8rem;
			font-size: 1rem;
		}
		.primary,
		.secondary,
		.destructive {
			min-height: 44px;
		}
	}
</style>
