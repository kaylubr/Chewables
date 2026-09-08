import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";
import { StorageError } from "../adapters/storage/storage.js";
import * as photosService from "./photos.service.js";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function registerAgent(): Promise<request.Agent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({
    email: "storefail@example.com",
    password: "password123",
    username: "storefailuser",
  });
  return agent;
}

function pngBytes(): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x30)]);
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

describe("storage failures", () => {
  it("storage failure on create leaves no photo record", async () => {
    const agent = await registerAgent();
    const putStub = vi
      .spyOn(photosService, "createPhoto")
      .mockImplementation(async () => {
        throw new StorageError("simulated outage");
      });

    const resp = await upload(agent);
    expect(resp.status).toBe(503);

    putStub.mockRestore();
    const rows = await db.select().from(schema.photos);
    expect(rows).toHaveLength(0);
  });

  it("delete storage failure keeps the record", async () => {
    const agent = await registerAgent();
    const createResp = await upload(agent);
    const photoId = createResp.body.id as string;
    expect(createResp.status).toBe(201);

    const deleteStub = vi
      .spyOn(photosService, "deletePhoto")
      .mockImplementation(async () => {
        throw new StorageError("simulated outage");
      });

    const resp = await agent.delete(`/api/photos/${photoId}`);
    expect(resp.status).toBe(503);

    deleteStub.mockRestore();
    const rows = await db.select().from(schema.photos);
    expect(rows).toHaveLength(1);
  });
});
