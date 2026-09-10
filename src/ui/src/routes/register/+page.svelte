<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, ApiError } from '$lib/api/client';
	import { auth } from '$lib/auth/store.svelte';
	import { startGoogleSignIn, type GoogleAuthController } from '$lib/auth/oauth';
	import { toastStore } from '$lib/toasts/toasts.svelte';

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let confirm = $state('');
	let submitting = $state(false);
	let googlePending = $state(false);
	let googleFlow: GoogleAuthController | null = null;

	function nextParam(): string {
		const params = new URLSearchParams(location.search);
		const next = params.get('next');
		return next && next.startsWith('/') ? next : '/profile';
	}

	async function continueWithGoogle() {
		if (googlePending) return;
		googlePending = true;
		googleFlow = startGoogleSignIn(nextParam());
		const outcome = await googleFlow.result;
		googleFlow = null;
		if (outcome.status === 'success') {
			auth.setUser(outcome.user);
			toastStore.success('Signed in.');
			goto(nextParam());
			return;
		}
		googlePending = false;
		if (outcome.status === 'blocked') {
			window.location.assign(outcome.url);
			return;
		}
		if (outcome.status === 'error') {
			toastStore.error(outcome.message);
		}
	}

	function cancelGoogle() {
		googleFlow?.cancel();
	}

	async function submit() {
		if (password !== confirm) {
			toastStore.error('Passwords do not match.');
			return;
		}
		if (password.length < 8) {
			toastStore.error('Password must be at least 8 characters.');
			return;
		}
		submitting = true;
		try {
			const res = await api.register(email, username, password);
			auth.setUser(res);
			toastStore.success('Account created.');
			goto('/profile');
		} catch (e) {
			toastStore.error(e instanceof ApiError ? e.message : 'Could not create the account. Please retry.');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create account</title>
</svelte:head>

<main class="auth-page">
	<h1>Create an account</h1>
	<p class="sub">Accounts are only for saving photos to your gallery.</p>

	<div class="social">
		<button type="button" class="social-btn" onclick={continueWithGoogle} disabled={googlePending}>
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
				<!-- Icon from Material Icon Theme by Material Extensions - https://github.com/material-extensions/vscode-material-icon-theme/blob/main/LICENSE -->
				<g fill="none" fill-rule="evenodd" clip-rule="evenodd">
					<path fill="#f44336" d="M7.209 1.061c.725-.081 1.154-.081 1.933 0a6.57 6.57 0 0 1 3.65 1.82a100 100 0 0 0-1.986 1.93q-1.876-1.59-4.188-.734q-1.696.78-2.362 2.528a78 78 0 0 1-2.148-1.658a.26.26 0 0 0-.16-.027q1.683-3.245 5.26-3.86" opacity=".987"/>
					<path fill="#ffc107" d="M1.946 4.92q.085-.013.161.027a78 78 0 0 0 2.148 1.658A7.6 7.6 0 0 0 4.04 7.99q.037.678.215 1.331L2 11.116Q.527 8.038 1.946 4.92" opacity=".997"/>
					<path fill="#448aff" d="M12.685 13.29a26 26 0 0 0-2.202-1.74q1.15-.812 1.396-2.228H8.122V6.713q3.25-.027 6.497.055q.616 3.345-1.423 6.032a7 7 0 0 1-.51.49" opacity=".999"/>
					<path fill="#43a047" d="M4.255 9.322q1.23 3.057 4.51 2.854a3.94 3.94 0 0 0 1.718-.626q1.148.812 2.202 1.74a6.62 6.62 0 0 1-4.027 1.684a6.4 6.4 0 0 1-1.02 0Q3.82 14.524 2 11.116z" opacity=".993"/>
				</g>
			</svg>
			<span>Continue with Google</span>
		</button>
	</div>

	<div class="divider"><span>or with email</span></div>

	<form onsubmit={(e) => { e.preventDefault(); void submit(); }}>
		<label>
			Username
			<input
				type="text"
				bind:value={username}
				required
				autocomplete="username"
				minlength="3"
				maxlength="32"
				pattern="[a-z0-9_]+"
				title="3-32 characters: lowercase letters, digits, underscores"
			/>
		</label>
		<label>
			Email
			<input type="email" bind:value={email} required autocomplete="email" />
		</label>
		<label>
			Password
			<input type="password" bind:value={password} required autocomplete="new-password" minlength="8" />
		</label>
		<label>
			Confirm password
			<input type="password" bind:value={confirm} required autocomplete="new-password" />
		</label>

		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Creating…' : 'Create account'}
		</button>
	</form>

	<p class="alt">
		Already have an account? <a href="/login">Sign in</a>
	</p>
</main>

{#if googlePending}
	<div class="modal-backdrop">
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="googleAuthTitle">
			<span class="spinner" aria-hidden="true"></span>
			<p id="googleAuthTitle" class="modal-text">Connecting your Google account…</p>
			<button type="button" class="modal-cancel" onclick={cancelGoogle}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	.auth-page {
		max-width: 24rem;
		margin: 0 auto;
		padding: 3rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
	}
	.auth-page h1 {
		font-weight: 640;
	}
	.sub {
		color: var(--ink-soft);
		margin-top: -0.5rem;
	}
	.social {
		display: grid;
		gap: 0.6rem;
		margin-top: 1.5rem;
	}
	.social-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.5rem;
		background: var(--surface);
		color: var(--ink);
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.social-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.social-btn:hover {
		border-color: var(--ember);
		color: var(--ember);
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}
	form {
		display: grid;
		gap: 1rem;
		margin-top: 0;
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
	.primary {
		background: var(--ember);
		color: white;
		border: none;
		border-radius: 0.5rem;
		padding: 0.75rem;
		font-weight: 650;
		font-size: var(--text-base);
		cursor: pointer;
	}
	.primary:hover {
		background: var(--ember-deep);
	}
	.primary:disabled {
		opacity: 0.6;
	}
	.alt {
		margin-top: 1.25rem;
		font-size: 0.95rem;
		color: var(--ink-soft);
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(0 0 0 / 0.45);
		z-index: 50;
		padding: 1rem;
	}
	.modal {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: 1.75rem 2rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--ink);
		text-align: center;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
		font-family: var(--font-ui);
	}
	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--line);
		border-top-color: var(--ember);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.modal-text {
		margin: 0;
		font-size: var(--text-base);
		font-weight: 600;
	}
	.modal-cancel {
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		color: var(--ink-soft);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		text-decoration: underline;
	}
	.modal-cancel:hover {
		color: var(--ember);
	}
	@media (pointer: coarse) {
		input {
			padding-block: 0.8rem;
			font-size: 1rem;
		}
		.primary {
			min-height: 48px;
		}
	}
</style>
