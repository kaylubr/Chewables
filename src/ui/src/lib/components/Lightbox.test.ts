// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Lightbox from "./Lightbox.svelte";

const photos = [
	{ id: "a", url: "https://example.test/a.webp" },
	{ id: "b", url: "https://example.test/b.webp" },
	{ id: "c", url: "https://example.test/c.webp" },
];

function setup(overrides: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	return {
		onClose,
		...render(Lightbox, {
			props: { photos, index: 0, onClose, ...overrides },
		}),
	};
}

function backdrop(): HTMLElement {
	return document.querySelector('[role="dialog"]') as HTMLElement;
}

/**
 * The viewer is a three-panel track, so the visible photo is identified by the
 * live-region position rather than by looking for a "current" image.
 */
function position(text: string) {
	return screen.getByText(text);
}

describe("Lightbox", () => {
	it("opens on the requested photo", () => {
		setup({ index: 1 });
		expect(position("Photo 2 of 3")).toBeTruthy();
		expect(screen.getAllByAltText("Saved photobooth result")).toHaveLength(3);
	});

	it("focuses the close button when it opens", async () => {
		setup();
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("button", { name: "Close photo viewer" }),
			),
		);
	});

	it("returns focus to the trigger when it unmounts", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.focus();

		const { unmount } = setup();
		unmount();

		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it("closes on Escape", async () => {
		const { onClose } = setup();
		await fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes when the backdrop is clicked", async () => {
		const { onClose } = setup();
		await fireEvent.click(backdrop());
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not close when the photo itself is clicked", async () => {
		const { onClose } = setup();
		await fireEvent.click(screen.getAllByAltText("Saved photobooth result")[1]);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("calls onClose once when the close button is clicked", async () => {
		const { onClose } = setup();
		await fireEvent.click(
			screen.getByRole("button", { name: "Close photo viewer" }),
		);
		// The button calls onClose itself; the backdrop handler must not add a
		// second call for the same click.
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("steps forward with ArrowRight", async () => {
		setup();
		await fireEvent.keyDown(window, { key: "ArrowRight" });
		await waitFor(() => expect(position("Photo 2 of 3")).toBeTruthy());
	});

	it("steps back with ArrowLeft", async () => {
		setup({ index: 2 });
		await fireEvent.keyDown(window, { key: "ArrowLeft" });
		await waitFor(() => expect(position("Photo 2 of 3")).toBeTruthy());
	});

	it("wraps forward from the last photo to the first", async () => {
		setup({ index: 2 });
		await fireEvent.keyDown(window, { key: "ArrowRight" });
		await waitFor(() => expect(position("Photo 1 of 3")).toBeTruthy());
	});

	it("wraps back from the first photo to the last", async () => {
		setup();
		await fireEvent.keyDown(window, { key: "ArrowLeft" });
		await waitFor(() => expect(position("Photo 3 of 3")).toBeTruthy());
	});

	it("steps forward when the next chevron is clicked", async () => {
		setup();
		await fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
		await waitFor(() => expect(position("Photo 2 of 3")).toBeTruthy());
	});

	it("steps back when the previous chevron is clicked", async () => {
		setup({ index: 1 });
		await fireEvent.click(
			screen.getByRole("button", { name: "Previous photo" }),
		);
		await waitFor(() => expect(position("Photo 1 of 3")).toBeTruthy());
	});

	it("hides the navigation controls for a single photo", () => {
		setup({ photos: [photos[0]] });
		expect(screen.queryByRole("button", { name: "Previous photo" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
		expect(position("Photo 1 of 1")).toBeTruthy();
	});

	// With two photos the previous and next panels hold the same photo, which
	// the positional panel keys have to tolerate.
	it("navigates a two-photo set", async () => {
		setup({ photos: [photos[0], photos[1]] });
		expect(screen.getAllByAltText("Saved photobooth result")).toHaveLength(3);

		await fireEvent.keyDown(window, { key: "ArrowRight" });
		await waitFor(() => expect(position("Photo 2 of 2")).toBeTruthy());
	});

	// jsdom reports a 1024px viewport, so the commit threshold is 256px.
	async function drag(fromX: number, toX: number, fromY = 100, toY = 100) {
		const target = backdrop();
		const init = { pointerId: 1, pointerType: "touch" };
		await fireEvent.pointerDown(target, { ...init, clientX: fromX, clientY: fromY });
		await fireEvent.pointerMove(target, { ...init, clientX: toX, clientY: toY });
		await fireEvent.pointerUp(target, { ...init, clientX: toX, clientY: toY });
	}

	it("advances when a leftward swipe passes the threshold", async () => {
		setup();
		await drag(600, 200);
		await waitFor(() => expect(position("Photo 2 of 3")).toBeTruthy());
	});

	it("steps back when a rightward swipe passes the threshold", async () => {
		setup({ index: 1 });
		await drag(200, 600);
		await waitFor(() => expect(position("Photo 1 of 3")).toBeTruthy());
	});

	it("springs back when the swipe is under the threshold", async () => {
		setup();
		await drag(600, 540);
		expect(position("Photo 1 of 3")).toBeTruthy();
	});

	it("ignores a mostly vertical drag", async () => {
		setup();
		await drag(600, 380, 100, 400);
		expect(position("Photo 1 of 3")).toBeTruthy();
	});

	it("ignores a mouse drag", async () => {
		setup();
		const target = backdrop();
		const mouse = { pointerId: 2, pointerType: "mouse", clientY: 100 };
		await fireEvent.pointerDown(target, { ...mouse, clientX: 600 });
		await fireEvent.pointerMove(target, { ...mouse, clientX: 200 });
		await fireEvent.pointerUp(target, { ...mouse, clientX: 200 });
		expect(position("Photo 1 of 3")).toBeTruthy();
	});

	it("falls back to the first photo when the index is out of range", () => {
		setup({ index: 99 });
		expect(position("Photo 1 of 3")).toBeTruthy();
	});

	it("shows a placeholder when an image fails to load", async () => {
		setup({ photos: [photos[0]] });
		// A one-photo set fills all three panels with the same image, so every
		// panel for that url falls back together.
		await fireEvent.error(screen.getAllByAltText("Saved photobooth result")[0]);
		expect(screen.getAllByText("unavailable").length).toBeGreaterThan(0);
	});
});
