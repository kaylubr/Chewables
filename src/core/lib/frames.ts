/**
 * Supported frame identifiers, shared with the frontend-owned vocabulary.
 *
 * The backend does not know how a frame renders — it only validates that a
 * persisted photo's frame identifier is one of these supported values.
 */
export const FRAME_IDS = ['VINTAGE', 'POLAROID', 'FILM', 'CLASSIC'] as const;

export type FrameId = (typeof FRAME_IDS)[number];

export function isSupportedFrame(frame: string): boolean {
	return (FRAME_IDS as readonly string[]).includes(frame);
}