import type { BoothSession } from './session';

export type CameraErrorKind =
	| 'permission-denied'
	| 'not-found'
	| 'in-use'
	| 'unavailable'
	| 'unknown';

export interface CameraErrorInfo {
	kind: CameraErrorKind;
	message: string;
}

export function classifyCameraError(error: unknown): CameraErrorInfo {
	const name =
		typeof error === 'object' && error !== null && 'name' in error
			? String((error as { name: unknown }).name)
			: '';

	switch (name) {
		case 'NotAllowedError':
		case 'PermissionDeniedError':
			return {
				kind: 'permission-denied',
				message:
					'Camera access was denied. Allow camera access in your browser settings, then try again.'
			};
		case 'NotFoundError':
		case 'DevicesNotFoundError':
			return {
				kind: 'not-found',
				message: 'No camera was found on this device.'
			};
		case 'NotReadableError':
		case 'TrackStartError':
			return {
				kind: 'in-use',
				message:
					'The camera is already in use by another application. Close it and retry.'
			};
		case 'OverconstrainedError':
			return {
				kind: 'unavailable',
				message: 'The camera does not support the required settings.'
			};
		default:
			return {
				kind: 'unknown',
				message: 'Could not start the camera. Please retry.'
			};
	}
}

export type CameraSession = {
	stream: MediaStream;
	stop: () => void;
};

export async function startCamera(): Promise<CameraSession> {
	const stream = await navigator.mediaDevices.getUserMedia({
		video: { width: { ideal: 1280 }, height: { ideal: 720 } },
		audio: false
	});
	return {
		stream,
		stop: () => {
			for (const track of stream.getTracks()) track.stop();
		}
	};
}

export type { BoothSession };
