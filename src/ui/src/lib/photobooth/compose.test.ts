import { describe, expect, it } from 'vitest';
import { getFrame } from '../frames/frames';
import { composePhoto, coverSourceRect } from './compose';
import type { PhotoSlot } from '../frames/types';

describe('coverSourceRect', () => {
	it('center-crops a wide photo into a tall slot', () => {
		const rect = coverSourceRect(1600, 900, { width: 400, height: 600 });
		expect(rect.sh).toBeCloseTo(900);
		expect(rect.sw).toBeCloseTo(600);
		expect(rect.sx).toBeCloseTo(500);
		expect(rect.sy).toBeCloseTo(0);
	});

	it('center-crops a tall photo into a wide slot', () => {
		const rect = coverSourceRect(900, 1600, { width: 600, height: 400 });
		expect(rect.sw).toBeCloseTo(900);
		expect(rect.sh).toBeCloseTo(600);
		expect(rect.sx).toBeCloseTo(0);
		expect(rect.sy).toBeCloseTo(500);
	});

	it('leaves an exact-ratio photo uncropped', () => {
		const rect = coverSourceRect(800, 1200, { width: 400, height: 600 });
		expect(rect.sx).toBeCloseTo(0);
		expect(rect.sy).toBeCloseTo(0);
		expect(rect.sw).toBeCloseTo(800);
		expect(rect.sh).toBeCloseTo(1200);
	});
});

describe('composePhoto', () => {
	function fakePhoto(naturalWidth: number, naturalHeight: number) {
		return {
			naturalWidth,
			naturalHeight,
			src: ''
		} as HTMLImageElement;
	}

	function recordingCanvas() {
		const calls: Array<{ op: string; args: unknown[] }> = [];
		const ctx = {
			save: () => calls.push({ op: 'save', args: [] }),
			restore: () => calls.push({ op: 'restore', args: [] }),
			translate: (...a: unknown[]) => calls.push({ op: 'translate', args: a }),
			rotate: (...a: unknown[]) => calls.push({ op: 'rotate', args: a }),
			drawImage: (...a: unknown[]) => calls.push({ op: 'drawImage', args: a })
		} as unknown as CanvasRenderingContext2D;
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => ctx,
			toDataURL: () => 'data:image/webp;base64,composed'
		} as unknown as HTMLCanvasElement;
		return { canvas, calls };
	}

	it('draws one photo per slot then the overlay on top', async () => {
		const frame = getFrame('FILM')!;
		const { canvas, calls } = recordingCanvas();

		const images = {
			'/frames/classic.png': fakePhoto(564, 1365)
		};
		const photo = fakePhoto(800, 600);
		const loadImage = (src: string) =>
			Promise.resolve(src === frame.image ? images['/frames/classic.png'] : photo);

		const dataUrl = await composePhoto(
			frame,
			[
				{ dataUrl: 'p0', index: 0 },
				{ dataUrl: 'p1', index: 1 },
				{ dataUrl: 'p2', index: 2 },
				{ dataUrl: 'p3', index: 3 }
			],
			{ loadImage, createCanvas: () => canvas }
		);

		expect(dataUrl).toBe('data:image/webp;base64,composed');
		const draws = calls.filter((c) => c.op === 'drawImage');
		expect(draws).toHaveLength(5);

		expect(canvas.width).toBe(564);
		expect(canvas.height).toBe(1365);

		const last = draws[draws.length - 1].args;
		expect(last[0]).toBe(images['/frames/classic.png']);
	});

	it('throws when captures are fewer than the frame requires', async () => {
		const frame = getFrame('FILM')!;
		await expect(
			composePhoto(frame, [{ dataUrl: 'p0', index: 0 }], {
				createCanvas: () => recordingCanvas().canvas
			})
		).rejects.toThrow(/need 4 captures/i);
	});

	it('uses the slot rectangle as the draw destination', async () => {
	const frame = getFrame('FILM')!;
	const slot: PhotoSlot = frame.photoSlots[0];
	const { canvas, calls } = recordingCanvas();
	const photo = fakePhoto(800, 600);
	const loadImage = (src: string) =>
		Promise.resolve(src === frame.image ? fakePhoto(564, 1365) : photo);

		await composePhoto(
			frame,
			[0, 1, 2, 3].map((i) => ({ dataUrl: `p${i}`, index: i })),
			{ loadImage, createCanvas: () => canvas }
		);

		const firstPhotoDraw = calls.find((c) => c.op === 'drawImage')!.args;
		expect(firstPhotoDraw[5]).toBe(slot.x);
		expect(firstPhotoDraw[6]).toBe(slot.y);
		expect(firstPhotoDraw[7]).toBe(slot.width);
		expect(firstPhotoDraw[8]).toBe(slot.height);
	});
});
