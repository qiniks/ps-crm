// Validation for product-photo uploads, shared by the upload route and its
// tests. Kept pure/tested here rather than inline in the route, same
// convention as tariffs.ts / reservations.ts / shifts.ts.

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function isAllowedImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

export function isAllowedImageSize(bytes: number): boolean {
  return bytes <= MAX_IMAGE_BYTES;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function imageExtension(contentType: string): string | null {
  return EXTENSION_BY_TYPE[contentType] ?? null;
}
