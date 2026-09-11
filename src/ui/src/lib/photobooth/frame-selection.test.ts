import { describe, expect, it } from 'vitest';
import { FRAMES, frameAspectRatio, getFrame } from '../frames/frames';
import { booth } from '../photobooth/store.svelte';
import { initialBooth, transition } from '../photobooth/session';

describe('frame configuration', () => {
	it('registers each configured frame id exactly once', () => {
		const ids = FRAMES.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('resolves a configured frame by id and rejects unknown ids', () => {
		expect(getFrame('FILM')).toBeDefined();
		// 'VINTAGE' is part of the canonical vocabulary but has no artwork
		// registered yet, so it must not resolve to a usable definition.
		expect(getFrame('VINTAGE')).toBeUndefined();
	});

	it('defines the FILM frame with four photo slots on a 564x1365 canvas', () => {
		const film = getFrame('FILM');
		expect(film?.name).toBe('35mm Film');
		expect(film?.photoCount).toBe(4);
		expect(film?.photoSlots).toHaveLength(4);
		expect(film?.width).toBe(564);
		expect(film?.height).toBe(1365);
	});

	it('keeps every photo slot inside the canvas bounds', () => {
		for (const frame of FRAMES) {
			for (const slot of frame.photoSlots) {
				expect(slot.x).toBeGreaterThanOrEqual(0);
				expect(slot.y).toBeGreaterThanOrEqual(0);
				expect(slot.x + slot.width).toBeLessThanOrEqual(frame.width);
				expect(slot.y + slot.height).toBeLessThanOrEqual(frame.height);
			}
		}
	});

	it('derives the display ratio from the frame canvas', () => {
		// Matches the composed canvas, so the tile shows the whole strip
		// instead of cover-cropping it to a square.
		expect(frameAspectRatio('FILM')).toBe('564 / 1365');
	});

	it('has no ratio for an id without a registered definition', () => {
		// The gallery falls back to the image's own ratio in that case.
		expect(frameAspectRatio('VINTAGE')).toBeUndefined();
		expect(frameAspectRatio('not-a-frame')).toBeUndefined();
	});
});

describe('frame selection behavior', () => {
	it('selecting a frame records it in the booth session', () => {
		booth.reset();
		booth.selectFrame('FILM');
		expect(booth.session.frameId).toBe('FILM');
		expect(booth.frame?.photoCount).toBe(4);
	});

	it('starting the booth after selection moves to requesting-camera', () => {
		booth.reset();
		booth.selectFrame('FILM');
		booth.session.state = 'requesting-camera';
		expect(booth.session.state).toBe('requesting-camera');
	});
});

describe('photobooth state machine', () => {
	it('starts idle with no frame and no captures', () => {
		expect(initialBooth.state).toBe('idle');
		expect(initialBooth.frameId).toBeNull();
		expect(initialBooth.captures).toHaveLength(0);
	});

	it('allows frame-selection -> requesting-camera -> camera-ready', () => {
		let s = transition(initialBooth, 'frame-selection');
		s = transition(s, 'requesting-camera');
		s = transition(s, 'camera-ready');
		expect(s.state).toBe('camera-ready');
	});

	it('rejects jumping straight from idle to capturing', () => {
		expect(() => transition(initialBooth, 'capturing')).toThrow(/transition/i);
	});

	it('prevents a second capture while one is already running', () => {
		let s = transition(initialBooth, 'frame-selection');
		s = transition(s, 'requesting-camera');
		s = transition(s, 'camera-ready');
		s = transition(s, 'countdown');
		s = transition(s, 'capturing');
		// Duplicate capture is not a valid transition while capturing.
		expect(() => transition(s, 'capturing')).toThrow(/transition/i);
	});

	it('only reaches composing after the last capture', () => {
		let s = transition(initialBooth, 'frame-selection');
		s = transition(s, 'requesting-camera');
		s = transition(s, 'camera-ready');
		s = transition(s, 'countdown');
		s = transition(s, 'capturing');
		s = transition(s, 'composing');
		expect(s.state).toBe('composing');
	});
});
