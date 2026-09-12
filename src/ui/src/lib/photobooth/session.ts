/**
 * Client-side photobooth session state.
 *
 * Everything here is ephemeral and lives only in the browser — nothing is
 * uploaded for guests. A guest completing the full flow (frame -> capture ->
 * composition -> download) never touches the backend.
 *
 * State machine guards invalid transitions: capture can only start when the
 * camera is ready, only one capture runs at a time, etc.
 */
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
	/** Data URL of the captured still (webcam frame). */
	dataUrl: string;
	/** Monotonic capture sequence, starting at 0. */
	index: number;
}

export interface BoothSession {
	state: BoothState;
	frameId: FrameId | null;
	/** Webcam stills in capture order. */
	captures: PhotoCapture[];
	/** Composition stage countdown remaining seconds (5s between captures). */
	countdown: number;
	/** Data URL of the composed result, once composition finishes. */
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

/**
 * Transition the session to a new state.
 * Returns a new session object; invalid transitions throw so callers can
 * never drive the flow into an impossible state by accident.
 */
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
