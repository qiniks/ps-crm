import { describe, expect, it } from "vitest";
import { resolveSafeRedirect } from "./resolveSafeRedirect";

const REQUEST_URL = "https://app.example.com/auth/callback";
const FALLBACK_PATH = "/set-password";
const FALLBACK_URL = "https://app.example.com/set-password";

describe("resolveSafeRedirect", () => {
  it("resolves a same-origin relative path", () => {
    const result = resolveSafeRedirect("/set-password", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("preserves query string on a same-origin relative path", () => {
    const result = resolveSafeRedirect("/dashboard?foo=bar", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe("https://app.example.com/dashboard?foo=bar");
  });

  it("falls back for a cross-origin absolute URL", () => {
    const result = resolveSafeRedirect("https://evil.com", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("falls back for a protocol-relative URL", () => {
    const result = resolveSafeRedirect("//evil.com", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("falls back for a backslash variant that WHATWG treats as protocol-relative", () => {
    const result = resolveSafeRedirect("/\\evil.com", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("falls back for a same-origin absolute URL whose pathname itself starts with //", () => {
    // This is THE bug this fix closes: origin check alone passes here because
    // the URL is same-origin, but the pathname "//evil.com" is protocol-relative
    // if it's ever re-parsed alone as a bare string later.
    const result = resolveSafeRedirect(
      "https://app.example.com//evil.com",
      REQUEST_URL,
      FALLBACK_PATH
    );
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("falls back when next is absent (null)", () => {
    const result = resolveSafeRedirect(null, REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });

  it("falls back for a malformed/unparseable next value without throwing", () => {
    expect(() => resolveSafeRedirect("http://", REQUEST_URL, FALLBACK_PATH)).not.toThrow();
    const result = resolveSafeRedirect("http://", REQUEST_URL, FALLBACK_PATH);
    expect(result.toString()).toBe(FALLBACK_URL);
  });
});
