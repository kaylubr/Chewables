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

	addCapture(capture: PhotoCapture) {
		this.session.captures = [...this.session.captures, capture];
	}

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
