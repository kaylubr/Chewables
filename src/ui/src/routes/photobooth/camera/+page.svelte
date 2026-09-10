<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { startCamera, classifyCameraError, type CameraErrorInfo } from '$lib/photobooth/camera';
	import { createCaptureController } from '$lib/photobooth/capture';
	import { composePhoto } from '$lib/photobooth/compose';
	import { booth } from '$lib/photobooth/store.svelte';

	let videoEl = $state<HTMLVideoElement | null>(null);
	let status = $state<'starting' | 'ready' | 'running' | 'error' | null>(null);
	let countdown = $state(0);
	let errorInfo = $state<CameraErrorInfo | null>(null);
	let flash = $state(false);

	const frame = booth.frame;
	const total = frame?.photoCount ?? 0;
	const taken = $derived(booth.session.captures.length);

	let camera: { stream: MediaStream; stop: () => void } | null = null;
	let controller: ReturnType<typeof createCaptureController> | null = null;

	function stopCamera() {
		camera?.stop();
		camera = null;
		if (videoEl) videoEl.srcObject = null;
	}

	async function startCameraPreview() {
		status = 'starting';
		errorInfo = null;
		try {
			camera = await startCamera();
		} catch (error) {
			errorInfo = classifyCameraError(error);
			status = 'error';
			return;
		}
		if (videoEl) {
			videoEl.srcObject = camera.stream;
			await videoEl.play().catch(() => {
				/* user gesture will resume if autoplay blocked */
			});
		}
		status = 'ready';
	}

	function snap(): string {
		if (!videoEl || !videoEl.videoWidth) throw new Error('Camera is not ready');
		const canvas = document.createElement('canvas');
		canvas.width = videoEl.videoWidth;
		canvas.height = videoEl.videoHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas unavailable');
		ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
		flash = true;
		setTimeout(() => (flash = false), 250);
		return canvas.toDataURL('image/jpeg', 0.92);
	}

	function beginCapture() {
		if (!frame || status !== 'ready') return;
		status = 'running';
		countdown = 5;
		controller = createCaptureController(
			frame,
			{ snap },
			(capture) => {
				booth.addCapture(capture);
			},
			(next) => {
				if (next === 'countdown') {
					countdown = controller?.countdown ?? 5;
				} else if (next === 'capturing') {
					countdown = 0;
				} else if (next === 'error') {
					status = 'error';
					errorInfo = {
						kind: 'unavailable',
						message: 'Capture failed. Check the camera and retry.'
					};
				} else if (next === 'composing') {
					status = null;
					void finish();
				}
			}
		);
		controller.start();
	}

	async function finish() {
		if (!frame || booth.session.captures.length < frame.photoCount) return;
		stopCamera();
		try {
			const url = await composePhoto(frame, booth.session.captures);
			booth.setResult(url);
			goto('/photobooth/result');
		} catch {
			status = 'error';
			errorInfo = { kind: 'unavailable', message: 'Could not compose your photobooth image.' };
		}
	}

	function retry() {
		errorInfo = null;
		status = null;
		void startCameraPreview();
	}

	function cancel() {
		controller?.abort();
		stopCamera();
		booth.reset();
		goto('/photobooth/frame');
	}

	onMount(() => {
		if (!frame) {
			goto('/photobooth/frame');
			return;
		}
		void startCameraPreview();
		return () => {
			controller?.abort();
			stopCamera();
		};
	});
</script>

<svelte:head>
	<title>Camera</title>
</svelte:head>

<main class="camera-page">
	<h1>Four shots, five seconds apart</h1>
	{#if frame}
		<p class="sub">
			{frame.name} needs {frame.photoCount} photos. Watch the countdown and hold still.
		</p>
	{/if}

	<div class="stage">
		{#if errorInfo}
			<div class="error-box" role="alert">
				<p class="error-title">{errorInfo.message}</p>
				{#if errorInfo.kind === 'permission-denied'}
					<p class="error-hint">
						Allow camera access for this site in your browser (look for the camera
						icon in the address bar), then retry.
					</p>
				{/if}
				<div class="row">
					<button type="button" class="ghost" onclick={() => goto('/photobooth/frame')}>
						Pick another frame
					</button>
					<button type="button" class="primary" onclick={retry}>Retry camera</button>
				</div>
			</div>
		{:else}
			<div class="video-wrap">
				<video
					bind:this={videoEl}
					class="preview"
					playsinline
					muted
					autoplay
					aria-label="Live camera preview"
				></video>

				{#if status === 'starting'}
					<p class="overlay">Requesting camera…</p>
				{:else if status === 'ready' && taken === 0}
					<button type="button" class="big-start" onclick={beginCapture}>
						Start capture
					</button>
				{/if}

				{#if flash}
					<div class="flash"></div>
				{/if}
				{#if status === 'running' && countdown > 0}
					<div class="countdown" aria-live="assertive">{countdown}</div>
				{/if}
			</div>

			{#if status === 'running' || taken > 0}
				<div class="progress" aria-label="Photo progress">
					{#each Array(total) as _, i}
						<span class="dot" class:filled={i < taken}></span>
					{/each}
					<span class="count">{taken}/{total}</span>
				</div>
			{/if}

			{#if status === 'ready' || status === 'running'}
				<div class="actions">
					<button type="button" class="ghost" onclick={cancel}>
						{status === 'running' ? 'Cancel session' : 'Restart'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</main>

<style>
	.camera-page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		font-family: var(--font-ui);
		color: var(--ink);
		text-align: center;
	}
	h1 {
		margin-bottom: 0.25rem;
		font-weight: 600;
	}
	.sub {
		color: var(--ink-soft);
		margin-top: 0;
		max-width: 40ch;
		margin-inline: auto;
	}
	.stage {
		margin-top: 1.5rem;
	}
	.video-wrap {
		position: relative;
		aspect-ratio: 4 / 3;
		background: var(--dev-bg);
		border-radius: 1rem;
		overflow: hidden;
		max-width: 640px;
		margin: 0 auto;
	}
	.preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.overlay {
		position: absolute;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		color: var(--dev-ink);
		background: color-mix(in oklch, var(--dev-bg) 70%, transparent);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: var(--text-sm);
		letter-spacing: 0.04em;
	}
	.big-start {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--ember);
		color: #fff;
		border: none;
		font-size: var(--text-base);
		font-weight: 600;
		padding: 0.9rem 1.8rem;
		border-radius: 999px;
		cursor: pointer;
		box-shadow: 0 4px 20px oklch(0.2 0.018 60 / 0.4);
	}
	.countdown {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 6rem;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--dev-ink);
		text-shadow: 0 2px 20px oklch(0.2 0.018 60 / 0.7);
	}
	.flash {
		position: absolute;
		inset: 0;
		background: oklch(0.97 0.012 75);
		opacity: 0.7;
		animation: fade 0.3s ease-out forwards;
		pointer-events: none;
	}
	@keyframes fade {
		from {
			opacity: 0.7;
		}
		to {
			opacity: 0;
		}
	}
	.progress {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--line);
	}
	.dot.filled {
		background: var(--ember);
	}
	.count {
		margin-left: 0.5rem;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.actions {
		margin-top: 1rem;
	}
	.error-box {
		max-width: 480px;
		margin: 2rem auto;
		padding: 1.5rem;
		background: var(--danger-bg);
		border: 1px solid var(--danger-line);
		border-radius: 0.75rem;
	}
	.error-title {
		color: var(--danger);
		font-weight: 600;
	}
	.error-hint {
		color: var(--danger);
		font-size: var(--text-sm);
		opacity: 0.85;
	}
	.row {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 1rem;
	}
	.primary {
		background: var(--ember);
		color: white;
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		font-weight: 600;
		cursor: pointer;
	}
	.primary:hover {
		background: var(--ember-deep);
	}
	.ghost {
		background: transparent;
		border: 1px solid var(--line-strong);
		color: var(--ink-soft);
		border-radius: 0.5rem;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
	}
	.ghost:hover {
		border-color: var(--ink-faint);
		color: var(--ink);
	}
	@media (max-width: 560px) {
		.camera-page {
			padding-inline: 0;
		}
		.camera-page h1 {
			padding-inline: 1rem;
		}
		.camera-page .sub {
			padding-inline: 1rem;
		}
		.video-wrap {
			border-radius: 0;
			max-width: none;
		}
		.countdown {
			font-size: clamp(4rem, 24vw, 6rem);
		}
		.big-start {
			font-size: var(--text-lg);
			padding: 1rem 2.4rem;
		}
	}
	@media (pointer: coarse) {
		.primary,
		.ghost,
		.big-start {
			min-height: 48px;
		}
		.progress {
			gap: 0.65rem;
			padding-block: 0.25rem;
		}
		.dot {
			width: 0.85rem;
			height: 0.85rem;
		}
	}
	.actions {
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
