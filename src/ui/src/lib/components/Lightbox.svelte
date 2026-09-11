<script lang="ts">
import { onMount, untrack } from "svelte";

/**
 * Full-screen photo viewer.
 *
 * Follows ConfirmDialog's modal conventions: the caller marks the page
 * behind it `inert`, focus moves to the close button on open and returns to
 * the tile on close, and Escape closes. On top of that it steps through the
 * set — arrow keys, edge chevrons, or a touch drag that carries the
 * neighbouring photo in with the finger — wrapping at both ends.
 *
 * There are no thumbnails in this app: the grid images already point at the
 * full stored object, so the enlarged view reuses the same URL and needs no
 * fetch of its own.
 */
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

// How far the finger must travel, as a share of the viewport width, before a
// release counts as a swipe rather than a nudge. Keep in step with the
// track's transition duration below.
const SWIPE_COMMIT_RATIO = 0.25;
const SWIPE_DURATION_MS = 250;

// Seeded once, deliberately: callers mount this only while the viewer is
// open, so a new photo means a new instance rather than a prop change.
let current = $state(
	untrack(() => (index >= 0 && index < photos.length ? index : 0)),
);

// Pixels the track is offset from centred, driven by the finger.
let drag = $state(0);
// Only true while the track is animating to a settled position, so the
// reset after a swap happens without a visible slide.
let animate = $state(false);
let brokenUrls = $state<Record<string, boolean>>({});

// Both are written by `bind:this` on mount, so they stay mutable. Biome's
// useConst rule only sees assignments in the script and would freeze them.
let closeButton = $state<HTMLButtonElement | undefined>();
let trackElement = $state<HTMLDivElement | undefined>();

const count = $derived(photos.length);
const canNavigate = $derived(count > 1);
// A one-photo set would just navigate to itself, so the controls stay hidden.
const prevPhoto = $derived(photos[(current - 1 + count) % count]);
const activePhoto = $derived(photos[current]);
const nextPhoto = $derived(photos[(current + 1) % count]);

const trackTransform = $derived(
	`translate3d(calc(-33.3333% + ${drag}px), 0, 0)`,
);

// Drag bookkeeping changes on every pointermove and never needs to render,
// so it lives outside reactive state.
let pointerId: number | null = null;
let startX = 0;
let startY = 0;
let axis: "x" | "y" | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let settleListener: (() => void) | null = null;
// A drag can still produce a trailing click; that click must not close the
// viewer out from under the gesture that just ended.
let suppressClick = false;

/**
 * Step one photo in `direction`, animating the track most of the way and
 * swapping the centre panel once it has arrived. Chevrons, arrow keys and a
 * completed swipe all funnel through here so they share one code path.
 */
function settle(direction: 1 | -1) {
	if (!canNavigate) return;
	animate = true;
	// Moving the track left reveals the panel on the right, and vice versa.
	// The overlay is fixed and full-viewport, so one panel is one viewport.
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
		// Batched with the transform reset, so the swap never slides back.
		animate = false;
		drag = 0;
	};

	// transitionend is the accurate signal, but it never fires when the
	// track has nowhere to move or transitions are disabled, so race it.
	settleListener = finish;
	settleTimer = setTimeout(finish, SWIPE_DURATION_MS + 80);
	trackElement?.addEventListener("transitionend", settleListener, {
		once: true,
	});
}

function handlePointerDown(event: PointerEvent) {
	// Mouse dragging would fight the click that opens and closes things, so
	// only touch drives the track; pointer events cover pen as well.
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
		// Wait for a deliberate movement before committing to a direction.
		if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
		axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
		if (axis === "x") suppressClick = true;
	}
	if (axis !== "x") return;

	// Clamped to one panel, so the neighbour can fill the frame but empty
	// track is never revealed. touch-action: pan-y keeps the browser from
	// scrolling sideways while we own the horizontal gesture.
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
	// Under the threshold: spring back to centre.
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
	// Clicks on the photo, the chevrons or the close button all land inside
	// the backdrop, so only clicks that hit the backdrop itself close it.
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

<!-- Keyboard dismissal lives on svelte:window with ConfirmDialog's Escape
     handling: an element-level handler would miss key presses once focus leaves
     the dialog, and keeping both would act on every key twice. -->
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
			<!-- Positional keys: with a one- or two-photo set the same photo can
			     occupy two panels, so ids would collide. -->
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
		/* Near-black, like a social photo viewer: the page behind should all but
		   disappear rather than tint the image. */
		background: rgb(0 0 0 / 0.92);
		z-index: 70;
		animation: fade 150ms ease;
		/* Owns the horizontal gesture; vertical stays with the browser. */
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
		/* Never upscaled past its natural size. */
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
