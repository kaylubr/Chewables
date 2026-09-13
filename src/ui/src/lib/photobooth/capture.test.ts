import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTDOWN_SECONDS, createCaptureController } from './capture';
import { getFrame } from '../frames/frames';

describe('capture controller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeFrame(photoCount: number) {
		const film = getFrame('FILM')!;
		return { ...film, photoCount };
	}

	function makeController(photoCount: number, snap: () => string = () => 'data:image/png;base64,x') {
		const frame = makeFrame(photoCount);
		const shots: string[] = [];
		const states: string[] = [];
		const controller = createCaptureController(
			frame,
			{ snap },
			(c) => shots.push(c.dataUrl),
			(s) => states.push(s)
		);
		return { controller, shots, states };
	}

	it('captures exactly photoCount images with a countdown before each', async () => {
		const { controller, shots, states } = makeController(2);
		controller.start();
		expect(states[0]).toBe('countdown');
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(shots).toHaveLength(1);
		expect(states).toContain('capturing');
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(shots).toHaveLength(2);
		expect(controller.done).toBe(true);
		expect(states[states.length - 1]).toBe('composing');
	});

	it('records each capture index in order', async () => {
		const indices: number[] = [];
		const frame = makeFrame(3);
		createCaptureController(
			frame,
			{ snap: () => 'x' },
			(c) => indices.push(c.index),
			() => {}
		).start();
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(indices).toEqual([0]);
	});

	it('start is idempotent while active', async () => {
		const { controller, shots } = makeController(2);
		controller.start();
		controller.start();
		controller.start();
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(shots).toHaveLength(1);
	});

	it('snap failure surfaces an error and stops', async () => {
		const { controller, states } = makeController(1, () => {
			throw new Error('camera died');
		});
		controller.start();
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(states).toContain('error');
		expect(controller.done).toBe(false);
	});

	it('abort stops the run without further shots', async () => {
		const { controller, shots } = makeController(3);
		controller.start();
		await vi.advanceTimersByTimeAsync(2000);
		controller.abort();
		await vi.advanceTimersByTimeAsync(COUNTDOWN_SECONDS * 1000);
		expect(shots).toHaveLength(0);
		expect(controller.done).toBe(true);
	});
});
