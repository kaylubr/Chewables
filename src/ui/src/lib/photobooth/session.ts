import type { FrameId } from '@chewable/shared';

export type BoothState =
	| 'idle'
	| 'frame-selection'
	| 'requesting-camera'
	| 'camera-ready'
	| 'countdown'
	| 'capturing'
	| 'composing'
	| 'result'
	| 'saving'
	| 'completed'
	| 'error';

export interface PhotoCapture {
	dataUrl: string;
	index: number;
}

export interface BoothSession {
	state: BoothState;
	frameId: FrameId | null;
	captures: PhotoCapture[];
	countdown: number;
	resultUrl: string | null;
	error: string | null;
}

export const initialBooth: BoothSession = {
	state: 'idle',
	frameId: null,
	captures: [],
	countdown: 0,
	resultUrl: null,
	error: null
};

export function transition(session: BoothSession, next: BoothState): BoothSession {
	assertTransition(session.state, next);
	return { ...session, state: next, error: next === 'error' ? session.error : null };
}

const ALLOWED: Record<BoothState, readonly BoothState[]> = {
	idle: ['frame-selection', 'error'],
	'frame-selection': ['requesting-camera', 'idle', 'error'],
	'requesting-camera': ['camera-ready', 'error', 'frame-selection'],
	'camera-ready': ['countdown', 'capturing', 'error', 'frame-selection'],
	countdown: ['capturing', 'camera-ready', 'error'],
	capturing: ['countdown', 'composing', 'error'],
	composing: ['result', 'error'],
	result: ['saving', 'idle', 'error'],
	saving: ['completed', 'error'],
	completed: ['idle', 'frame-selection'],
	error: ['idle', 'frame-selection']
};

function assertTransition(from: BoothState, to: BoothState): void {
	if (!ALLOWED[from].includes(to)) {
		throw new Error(`Invalid booth transition: ${from} -> ${to}`);
	}
}
