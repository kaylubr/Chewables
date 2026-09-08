import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { FRAME_IDS } from "@chewable/shared";
import { isSupportedFrame } from "../lib/frames.js";
import {
  InvalidImageError,
  MAX_UPLOAD_BYTES,
  ALLOWED_CONTENT_TYPES,
  storageKeyFor,
  validateUpload,
} from "./photos.service.js";

describe("frame validation", () => {
  it("accepts supported ids", () => {
    for (const id of FRAME_IDS) {
      expect(isSupportedFrame(id)).toBe(true);
    }
  });

  it("rejects unknown ids", () => {
    expect(isSupportedFrame("BOGUS")).toBe(false);
    expect(isSupportedFrame("")).toBe(false);
    expect(isSupportedFrame("film")).toBe(false);
  });
});

describe("upload validation", () => {
  it("accepts valid image types", () => {
    for (const ct of ALLOWED_CONTENT_TYPES) {
      expect(() => validateUpload(ct, 100)).not.toThrow();
    }
  });

  it("rejects invalid content type", () => {
    expect(() => validateUpload("text/html", 100)).toThrow(InvalidImageError);
  });

  it("rejects empty and oversized", () => {
    expect(() => validateUpload("image/png", 0)).toThrow(InvalidImageError);
    expect(() => validateUpload("image/png", MAX_UPLOAD_BYTES + 1)).toThrow(
      InvalidImageError,
    );
  });
});

describe("storage key generation", () => {
  it("is server generated and scoped to the user and photo", () => {
    const uid = randomUUID();
    const pid = randomUUID();
    const key = storageKeyFor(uid, pid);
    expect(key).toBe(`users/${uid}/photos/${pid}.webp`);
    expect(key).not.toContain("..");
  });
});
