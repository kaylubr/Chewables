import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";
import { StorageError, storage, type Storage } from "../adapters/storage/storage.js";
import { inMemoryStorage } from "../adapters/storage/in-memory.js";
import * as PhotoRepo from "./photos.repo.js";
import { createPhoto, deletePhoto } from "./photos.service.js";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngBytes(): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x30)]);
}

function failingStorage(): Storage {
  return {
    async ensureBucket(): Promise<void> {},
    async put(): Promise<void> {
      throw new StorageError("simulated outage");
    },
    async delete(): Promise<void> {
      throw new StorageError("simulated outage");
    },
    async url(): Promise<string> {
      throw new StorageError("simulated outage");
    },
  };
}

async function registerUser(email: string, username: string): Promise<string> {
  const resp = await request(app).post("/api/auth/register").send({
    email,
    password: "password123",
    username,
  });
  return resp.body.user.id as string;
}

async function registerAgent(
  email = "storefail@example.com",
  username = "storefailuser",
): Promise<request.Agent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({
    email,
    password: "password123",
    username,
  });
  return agent;
}

function upload(agent: request.Agent) {
  return agent
    .post("/api/photos")
    .field("frame", "FILM")
    .attach("file", pngBytes(), {
      filename: "photo.png",
      contentType: "image/png",
    });
}

describe("photo ordering under storage failures", () => {
  it("a failed upload leaves no photo record", async () => {
    const userId = await registerUser("create-fail@example.com", "createfail");

    await expect(
      createPhoto({
        userId,
        frame: "FILM",
        imageBytes: pngBytes(),
        contentType: "image/png",
        store: failingStorage(),
      }),
    ).rejects.toBeInstanceOf(StorageError);

    expect(await db.select().from(schema.photos)).toHaveLength(0);
  });

  it("a failed row insert removes the object that was already stored", async () => {
    const userId = await registerUser("insert-fail@example.com", "insertfail");
    const store = inMemoryStorage();
    const insertStub = vi
      .spyOn(PhotoRepo, "insertPhoto")
      .mockRejectedValue(new Error("insert failed"));

    await expect(
      createPhoto({
        userId,
        frame: "FILM",
        imageBytes: pngBytes(),
        contentType: "image/png",
        store,
      }),
    ).rejects.toThrow("insert failed");

    insertStub.mockRestore();
    expect(store.keys()).toHaveLength(0);
    expect(await db.select().from(schema.photos)).toHaveLength(0);
  });

  it("a failed object delete still leaves the row deleted first", async () => {
    const userId = await registerUser("delete-fail@example.com", "deletefail");
    const store = inMemoryStorage();
    const created = await createPhoto({
      userId,
      frame: "FILM",
      imageBytes: pngBytes(),
      contentType: "image/png",
      store,
    });
    expect(store.has(created.storageKey)).toBe(true);

    await expect(
      deletePhoto({ userId, photoId: created.id, store: failingStorage() }),
    ).rejects.toBeInstanceOf(StorageError);

    expect(await db.select().from(schema.photos)).toHaveLength(0);
    expect(store.has(created.storageKey)).toBe(true);
  });
});

describe("storage outages through the API", () => {
  it("answers 503 and records nothing when the upload cannot be stored", async () => {
    const agent = await registerAgent();
    const putStub = vi
      .spyOn(storage, "put")
      .mockRejectedValue(new StorageError("simulated outage"));

    const resp = await upload(agent);
    putStub.mockRestore();

    expect(resp.status).toBe(503);
    expect(await db.select().from(schema.photos)).toHaveLength(0);
  });

  it("answers 503 when the object cannot be deleted, with the row already gone", async () => {
    const agent = await registerAgent();
    const createResp = await upload(agent);
    const photoId = createResp.body.id as string;
    expect(createResp.status).toBe(201);

    const deleteStub = vi
      .spyOn(storage, "delete")
      .mockRejectedValue(new StorageError("simulated outage"));

    const resp = await agent.delete(`/api/photos/${photoId}`);
    deleteStub.mockRestore();

    expect(resp.status).toBe(503);
    expect(await db.select().from(schema.photos)).toHaveLength(0);
  });
});
