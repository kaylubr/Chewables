import { FRAME_IDS } from "@chewable/shared";

export function isSupportedFrame(frame: string): boolean {
	return (FRAME_IDS as readonly string[]).includes(frame);
}