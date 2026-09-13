import type { FrameId } from '@chewable/shared';

export interface PhotoSlot {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

export interface FrameDefinition {
	id: FrameId;
	name: string;
	image: string;
	photoCount: number;
	width: number;
	height: number;
	photoSlots: PhotoSlot[];
}
