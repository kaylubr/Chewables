<script lang="ts">
import { goto } from "$app/navigation";
import { ApiError, api } from "$lib/api/client";
import { auth } from "$lib/auth/store.svelte";
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
import Modal from "$lib/components/Modal.svelte";
import { downloadDataUrl, photoFilename } from "$lib/photobooth/download";
import { booth } from "$lib/photobooth/store.svelte";
import { toastStore } from "$lib/toasts/toasts.svelte";

const resultUrl = booth.session.resultUrl;
const frame = booth.frame;

let saving = $state(false);
let showSignInPrompt = $state(false);
let confirmSave = $state(false);

function download() {
	if (!resultUrl) return;
	downloadDataUrl(resultUrl, photoFilename(frame?.id));
}

function dataUrlToBlob(url: string): Blob {
	const [meta, b64] = url.split(",");
	const mime = /data:(.*?);/.exec(meta)?.[1] ?? "image/webp";
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}

function save() {
	if (!auth.isAuthenticated) {
		showSignInPrompt = true;
		return;
	}
	if (!resultUrl || !frame) return;
	confirmSave = true;
}

async function runSave() {
	if (!resultUrl || !frame) return;
	saving = true;
	try {
		await api.uploadPhoto(frame.id, dataUrlToBlob(resultUrl));
		booth.session.state = "completed";
		toastStore.success("Photo saved.");
		goto("/profile");
	} catch (e) {
		toastStore.error(
			e instanceof ApiError
				? e.message
				: "Could not save the photo. Please retry.",
		);
	} finally {
		saving = false;
		confirmSave = false;
	}
}

function confirmSignIn() {
	showSignInPrompt = false;
	toastStore.error("Sign in to save your photo.");
	goto("/login?next=/photos");
}

function startOver() {
	booth.reset();
	goto("/photobooth/frame");
}
</script>

<svelte:head>
	<title>Your photo</title>
</svelte:head>

<main class="result-page" inert={confirmSave}>
	{#if resultUrl}
		<h1>Your photo is ready</h1>
		<img
			class="result"
			src={resultUrl}
			alt={frame ? `Your finished ${frame.name.toLowerCase()} photobooth result` : 'Your finished photobooth result'}
			width="360"
		/>
		<div class="actions">
			<button type="button" class="primary" onclick={download}>Download</button>
			<button type="button" class="secondary" onclick={save}>
				{auth.isAuthenticated ? 'Save to my photos' : 'Save to account'}
			</button>
			<button type="button" class="ghost" onclick={startOver}>Take another</button>
		</div>
	{:else}
		<p class="empty">No finished photo in this session.</p>
		<button type="button" class="secondary" onclick={startOver}>Start over</button>
	{/if}
</main>

{#if showSignInPrompt}
	<Modal backdropClose onClose={() => (showSignInPrompt = false)}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="signin-title" tabindex="-1">
			<h2 id="signin-title">Sign in to save</h2>
			<p>
				Saving requires an account. This photo lives only in this browser tab — if you
				leave to sign in, you'll need to take it again to save it.
			</p>
			<div class="modal-actions">
				<button type="button" class="secondary" onclick={() => (showSignInPrompt = false)}>Cancel</button>
				<button type="button" class="primary" onclick={confirmSignIn}>Sign in to save</button>
			</div>
		</div>
	</Modal>
{/if}

{#if confirmSave}
	<ConfirmDialog
		open
		title="Save this photo?"
		confirmLabel="Save photo"
		busyLabel="Saving…"
		busy={saving}
		onConfirm={() => void runSave()}
		onCancel={() => (confirmSave = false)}
	>
		<p>
			It'll be added to your photos, where you can download or delete it later.
		</p>
	</ConfirmDialog>
{/if}

<style>
	.result-page {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
		text-align: center;
	}
	.result-page h1 {
		font-weight: 600;
	}
	.result {
		max-width: min(360px, 100%);
		border-radius: 0.5rem;
		box-shadow: 0 8px 30px oklch(0.28 0.03 55 / 0.22);
		margin: 1.5rem auto;
		display: block;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.primary,
	.secondary,
	.ghost {
		border-radius: 0.5rem;
		padding: 0.7rem 1.4rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-size: var(--text-base);
	}
	.primary {
		background: var(--ember);
		color: white;
	}
	.primary:hover {
		background: var(--ember-deep);
	}
	.secondary {
		background: var(--dev-bg);
		color: var(--dev-ink);
	}
	.secondary:hover {
		background: var(--dev-bg-raise);
	}
	.ghost {
		background: transparent;
		color: var(--ink-soft);
		border: 1px solid var(--line-strong);
	}
	.ghost:hover {
		border-color: var(--ink-faint);
		color: var(--ink);
	}
	.empty {
		color: var(--ink-soft);
	}
	@media (max-width: 480px) {
		.actions {
			flex-direction: column;
			gap: 0.6rem;
			max-width: 24rem;
			margin-inline: auto;
		}
		.actions button {
			width: 100%;
			padding-block: 0.85rem;
		}
	}
	@media (pointer: coarse) {
		.primary,
		.secondary,
		.ghost {
			min-height: 48px;
		}
	}
	.modal {
		background: var(--surface);
		color: var(--ink);
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: 26rem;
		width: 100%;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
		text-align: left;
	}
	.modal h2 {
		font-size: var(--text-xl);
		margin-top: 0;
	}
	.modal p {
		color: var(--ink-soft);
	}
	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		flex-wrap: wrap;
		margin-top: 1.25rem;
	}
</style>
