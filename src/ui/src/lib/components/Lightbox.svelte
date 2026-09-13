<script lang="ts">
import { onMount, untrack } from "svelte";

type LightboxPhoto = { id: string; url: string };

const {
	photos,
	index,
	onClose,
}: {
	photos: LightboxPhoto[];
	index: number;
	onClose: () => void;
} = $props();

const SWIPE_COMMIT_RATIO = 0.25;
const SWIPE_DURATION_MS = 250;

let current = $state(
	untrack(() => (index >= 0 && index < photos.length ? index : 0)),
);

let drag = $state(0);
let animate = $state(false);
let brokenUrls = $state<Record<string, boolean>>({});

let closeButton = $state<HTMLButtonElement | undefined>();
let trackElement = $state<HTMLDivElement | undefined>();

const count = $derived(photos.length);
const canNavigate = $derived(count > 1);
const prevPhoto = $derived(photos[(current - 1 + count) % count]);
const activePhoto = $derived(photos[current]);
const nextPhoto = $derived(photos[(current + 1) % count]);

const trackTransform = $derived(
	`translate3d(calc(-33.3333% + ${drag}px), 0, 0)`,
);

let pointerId: number | null = null;
let startX = 0;
let startY = 0;
let axis: "x" | "y" | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let settleListener: (() => void) | null = null;
let suppressClick = false;

function settle(direction: 1 | -1) {
	if (!canNavigate) return;
	animate = true;
	const width = window.innerWidth;
	drag = direction === 1 ? -width : width;

	let settled = false;
	const finish = () => {
		if (settled) return;
		settled = true;
		if (settleTimer !== null) clearTimeout(settleTimer);
		settleTimer = null;
		if (settleListener !== null) {
			trackElement?.removeEventListener("transitionend", settleListener);
			settleListener = null;
		}
		current = (current + direction + count) % count;
		animate = false;
		drag = 0;
	};

	settleListener = finish;
	settleTimer = setTimeout(finish, SWIPE_DURATION_MS + 80);
	trackElement?.addEventListener("transitionend", settleListener, {
		once: true,
	});
}

function handlePointerDown(event: PointerEvent) {
	if (event.pointerType === "mouse" || !canNavigate) return;
	pointerId = event.pointerId;
	startX = event.clientX;
	startY = event.clientY;
	axis = null;
	suppressClick = false;
	animate = false;
}

function handlePointerMove(event: PointerEvent) {
	if (pointerId !== event.pointerId) return;
	const dx = event.clientX - startX;
	const dy = event.clientY - startY;

	if (axis === null) {
		if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
		axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
		if (axis === "x") suppressClick = true;
	}
	if (axis !== "x") return;

	const limit = window.innerWidth;
	drag = Math.max(-limit, Math.min(limit, dx));
}

function handlePointerUp(event: PointerEvent) {
	if (pointerId !== event.pointerId) return;
	pointerId = null;
	const travelled = drag;
	axis = null;

	if (Math.abs(travelled) > window.innerWidth * SWIPE_COMMIT_RATIO) {
		settle(travelled < 0 ? 1 : -1);
		return;
	}
	animate = true;
	drag = 0;
}

function handlePointerCancel(event: PointerEvent) {
	if (pointerId !== event.pointerId) return;
	pointerId = null;
	axis = null;
	animate = true;
	drag = 0;
}

function handleBackdropClick(event: MouseEvent) {
	if (suppressClick) {
		suppressClick = false;
		return;
	}
	if ((event.target as HTMLElement).closest("img, button")) return;
	onClose();
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		event.preventDefault();
		onClose();
		return;
	}
	if (event.key === "ArrowLeft") {
		event.preventDefault();
		settle(-1);
		return;
	}
	if (event.key === "ArrowRight") {
		event.preventDefault();
		settle(1);
	}
}

function markBroken(url: string) {
	brokenUrls = { ...brokenUrls, [url]: true };
}

onMount(() => {
	const returnFocus = document.activeElement as HTMLElement | null;
	closeButton?.focus();
	return () => {
		returnFocus?.focus();
	};
});

$effect(() => {
	const previous = document.body.style.overflow;
	document.body.style.overflow = "hidden";
	return () => {
		document.body.style.overflow = previous;
	};
});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="backdrop"
	role="dialog"
	aria-modal="true"
	aria-label="Photo viewer"
	tabindex="-1"
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
>
	<div class="viewer">
		<div
			class="track"
			class:animate
			bind:this={trackElement}
			style:transform={trackTransform}
		>
			{#each [prevPhoto, activePhoto, nextPhoto] as photo, panel (panel)}
				<div class="panel">
					{#if brokenUrls[photo.url]}
						<div class="placeholder">unavailable</div>
					{:else}
						<img
							src={photo.url}
							alt="Saved photobooth result"
							draggable="false"
							onerror={() => markBroken(photo.url)}
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<button
		type="button"
		class="close"
		bind:this={closeButton}
		onclick={onClose}
		aria-label="Close photo viewer"
	>
		×
	</button>

	{#if canNavigate}
		<button type="button" class="nav prev" onclick={() => settle(-1)} aria-label="Previous photo">
			‹
		</button>
		<button type="button" class="nav next" onclick={() => settle(1)} aria-label="Next photo">
			›
		</button>
	{/if}

	<p class="sr-only" aria-live="polite">Photo {current + 1} of {count}</p>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(0 0 0 / 0.92);
		z-index: 70;
		animation: fade 150ms ease;
		touch-action: pan-y;
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.viewer {
		width: 100%;
		overflow: hidden;
	}

	.track {
		display: flex;
		width: 300%;
	}

	.track.animate {
		transition: transform 250ms ease;
	}

	.panel {
		width: 33.3333%;
		display: grid;
		place-items: center;
	}

	.panel img {
		max-width: 92%;
		max-height: 82vh;
		object-fit: contain;
		user-select: none;
		-webkit-user-drag: none;
	}

	.placeholder {
		color: rgb(255 255 255 / 0.7);
		font-family: var(--font-ui);
		font-size: var(--text-sm);
	}

	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: grid;
		place-items: center;
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0;
		background: none;
		border: none;
		color: #fff;
		font-family: var(--font-ui);
		font-size: var(--text-2xl);
		line-height: 1;
		cursor: pointer;
		opacity: 0.8;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
	}

	.close:hover,
	.close:focus-visible {
		opacity: 1;
	}

	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		padding: 0 0.5rem;
		background: none;
		border: none;
		color: #fff;
		font-family: var(--font-ui);
		font-size: var(--text-3xl);
		line-height: 1;
		cursor: pointer;
		opacity: 0.5;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
	}

	.nav:hover,
	.nav:focus-visible {
		opacity: 1;
	}

	.prev {
		left: 0;
	}

	.next {
		right: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	@media (pointer: coarse) {
		.close,
		.nav {
			min-width: 44px;
			min-height: 44px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.backdrop {
			animation: none;
		}

		.track.animate {
			transition: none;
		}
	}
</style>
