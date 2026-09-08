import { z } from "zod";
import { FRAME_IDS } from "@chewable/shared";

export const createPhotoSchema = z.object({
  frame: z.enum(FRAME_IDS),
});

export const photoIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreatePhotoBody = z.infer<typeof createPhotoSchema>;
export type PhotoIdParams = z.infer<typeof photoIdParamsSchema>;
