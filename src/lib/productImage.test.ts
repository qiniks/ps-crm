import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageExtension,
  isAllowedImageSize,
  isAllowedImageType,
} from "./productImage";

describe("isAllowedImageType", () => {
  it("accepts jpeg, png and webp", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects other content types", () => {
    expect(isAllowedImageType("image/gif")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("")).toBe(false);
  });
});

describe("isAllowedImageSize", () => {
  it("accepts sizes at or under the limit", () => {
    expect(isAllowedImageSize(MAX_IMAGE_BYTES)).toBe(true);
    expect(isAllowedImageSize(1024)).toBe(true);
    expect(isAllowedImageSize(0)).toBe(true);
  });

  it("rejects sizes over the limit", () => {
    expect(isAllowedImageSize(MAX_IMAGE_BYTES + 1)).toBe(false);
  });
});

describe("imageExtension", () => {
  it("maps each allowed type to its extension", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/webp")).toBe("webp");
  });

  it("returns null for a disallowed type", () => {
    expect(imageExtension("image/gif")).toBeNull();
  });
});

describe("ALLOWED_IMAGE_TYPES", () => {
  it("lists exactly the three supported content types", () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
