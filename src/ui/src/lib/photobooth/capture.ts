import type { FrameDefinition } from '../frames/types';
import type { PhotoCapture } from './session';

export const COUNTDOWN_SECONDS = 5;

export interface CaptureDeps {
	snap(): Promise<string> | string;
}

export interface CaptureController {
	shots: number;
	countdown: number;
	active: boolean;
	start(): void;
	abort(): void;
	done: boolean;
	finished: Promise<void>;
}

export function createCaptureController(
	frame: FrameDefinition,
	deps: CaptureDeps,
	onShot: (capture: PhotoCapture) => void,
	onState: (state: 'countdown' | 'capturing' | 'composing' | 'error') => void,
	intervalMs = 1000
): CaptureController {
	let shots = 0;
	let countdown = COUNTDOWN_SECONDS;
	let active = false;
	let done = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let resolveFinished: () => void;
	const finished = new Promise<void>((resolve) => {
		resolveFinished = resolve;
	});

	function clearTimer() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function finish() {
		clearTimer();
		active = false;
		done = true;
		resolveFinished();
	}

	function tick() {
		countdown -= 1;
		if (countdown > 0) {
			onState('countdown');
			return;
		}
		clearTimer();
		countdown = COUNTDOWN_SECONDS;
		void takeShot();
	}

	async function takeShot() {
		onState('capturing');
		let dataUrl: string;
		try {
			dataUrl = await deps.snap();
		} catch {
			active = false;
			onState('error');
			return;
		}
		const capture: PhotoCapture = { dataUrl, index: shots };
		shots += 1;
		onShot(capture);
		if (shots >= frame.photoCount) {
			onState('composing');
			finish();
			return;
		}
		timer = setInterval(tick, intervalMs);
		onState('countdown');
	}

	return {
		get shots() {
			return shots;
		},
		get countdown() {
			return countdown;
		},
		get active() {
			return active;
		},
		get done() {
			return done;
		},
		get finished() {
			return finished;
		},
		start() {
			if (active || done) return;
			active = true;
			countdown = COUNTDOWN_SECONDS;
			onState('countdown');
			timer = setInterval(tick, intervalMs);
		},
		abort() {
			if (!active) return;
			clearTimer();
			active = false;
			done = true;
			resolveFinished();
		}
	};
}
