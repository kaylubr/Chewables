import type { FrameId } from "@chewable/shared";
import type { FrameDefinition } from "./types";

export const FRAMES: FrameDefinition[] = [
  {
    id: "FILM",
    name: "35mm Film",
    image: "/frames/classic.png",
    photoCount: 4,
    width: 564,
    height: 1365,
    photoSlots: [
      { x: 84, y: 90, width: 399, height: 280, rotation: 0 },
      { x: 84, y: 392, width: 399, height: 279, rotation: 0 },
      { x: 84, y: 693, width: 399, height: 280, rotation: 0 },
      { x: 84, y: 1007, width: 399, height: 279, rotation: 0 },
    ],
  },
];

export const FRAME_BY_ID: ReadonlyMap<FrameId, FrameDefinition> = new Map(
  FRAMES.map((frame) => [frame.id, frame]),
);

export function getFrame(id: FrameId): FrameDefinition | undefined {
  return FRAME_BY_ID.get(id);
}

export function frameAspectRatio(id: string): string | undefined {
  const frame = FRAME_BY_ID.get(id as FrameId);
  return frame ? `${frame.width} / ${frame.height}` : undefined;
}
