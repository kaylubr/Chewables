/**
 * Shared photobooth store.
 *
 * A single module-level session shared across the /photobooth routes so the
 * selected frame and captures survive navigation from frame -> camera ->
 * result. Lives only in the browser; reloading resets the flow.
 */
import type { FrameId } from '@chewable/shared';
import { FRAME_BY_ID } from '../frames/frames';
import { initialBooth, type BoothSession, type PhotoCapture } from './session';

class PhotoboothStore {
	session = $state<BoothSession>({ ...initialBooth });

	get frame() {
		return this.session.frameId ? FRAME_BY_ID.get(this.session.frameId) : undefined;
	}

	selectFrame(id: FrameId) {
		this.session.frameId = id;
	}

	/** Append one captured still. */
	addCapture(capture: PhotoCapture) {
		this.session.captures = [...this.session.captures, capture];
	}

	/** Store the composed result and move to the result screen. */
	setResult(url: string) {
		this.session.resultUrl = url;
		this.session.state = 'result';
	}

	setError(message: string) {
		this.session.error = message;
		this.session.state = 'error';
	}

	reset() {
		this.session = { ...initialBooth };
	}
}

export const booth = new PhotoboothStore();
