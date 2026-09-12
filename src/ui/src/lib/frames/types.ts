/**
 * Frame system types.
 *
 * Frames are NOT database entities and NOT rendered server-side. A frame is a
 * static PNG overlay owned by the frontend, plus the configuration below that
 * describes where captured photos sit underneath it.
 *
 * Adding a frame = add the PNG to static/frames/ + add one entry to
 * src/lib/frames/frames.ts. No DB or backend change is required for a normal
 * frame.
 *
 * `FrameId` comes from `@chewable/shared`, so the ids the backend validates and
 * the ids the frontend renders cannot drift apart.
 */
import type { FrameId } from '@chewable/shared';

/** Where one captured photograph sits on the final canvas. */
export interface PhotoSlot {
	/** Horizontal position of the photo's top-left corner, in canvas px. */
	x: number;
	/** Vertical position of the photo's top-left corner, in canvas px. */
	y: number;
	/** Photo slot width in canvas px. */
	width: number;
	/** Photo slot height in canvas px. */
	height: number;
	/** Clockwise rotation of the photo in degrees. */
	rotation: number;
}

/** Static description of one frame overlay. */
export interface FrameDefinition {
	id: FrameId;
	/** Human-friendly name shown in the UI. */
	name: string;
	/** URL of the frame overlay PNG (served from static/). */
	image: string;
	/** How many webcam captures this frame needs. */
	photoCount: number;
	/** Final composed canvas width in px. */
	width: number;
	/** Final composed canvas height in px. */
	height: number;
	/**
	 * Photo placement, in order of capture. Coordinates are relative to the
	 * frame's canvas dimensions and must match the overlay artwork.
	 */
	photoSlots: PhotoSlot[];
}
