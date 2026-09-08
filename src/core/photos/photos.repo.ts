import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function insertPhoto(values: {
  id: string;
  userId: string;
  frame: string;
  storageKey: string;
}) {
  return db.insert(schema.photos).values(values).returning();
}

export async function deletePhotoById(id: string) {
  await db.delete(schema.photos).where(eq(schema.photos.id, id));
}

export async function findByUserId(userId: string) {
  return db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.userId, userId))
    .orderBy(schema.photos.createdAt);
}

export async function findOwnedById(userId: string, photoId: string) {
  return db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, photoId), eq(schema.photos.userId, userId)))
    .limit(1);
}
