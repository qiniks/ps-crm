import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));

vi.mock("./session", () => ({ getSessionUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getCookie }),
}));

import { getEffectiveUserId, getImpersonation, IMPERSONATION_COOKIE } from "./impersonation";

const ADMIN = { id: "admin-1", email: "admin@example.com" };
const MEMBER = { id: "user-1", email: "user@example.com" };

beforeEach(() => {
  getSessionUser.mockReset();
  getCookie.mockReset();
  vi.stubEnv("ADMIN_EMAIL", ADMIN.email);
});

function setCookie(value: unknown) {
  getCookie.mockImplementation((name: string) =>
    name === IMPERSONATION_COOKIE ? { value: JSON.stringify(value) } : undefined
  );
}

describe("getImpersonation", () => {
  it("honors the cookie for the admin session", async () => {
    getSessionUser.mockResolvedValue(ADMIN);
    setCookie({ userId: "user-1", email: "user@example.com" });

    expect(await getImpersonation()).toEqual({ userId: "user-1", email: "user@example.com" });
  });

  it("ignores a forged cookie on a non-admin session", async () => {
    getSessionUser.mockResolvedValue(MEMBER);
    setCookie({ userId: "someone-else", email: "x@example.com" });

    expect(await getImpersonation()).toBeNull();
  });

  it("ignores a malformed cookie", async () => {
    getSessionUser.mockResolvedValue(ADMIN);
    getCookie.mockReturnValue({ value: "not-json" });

    expect(await getImpersonation()).toBeNull();
  });
});

describe("getEffectiveUserId", () => {
  it("returns null when unauthenticated", async () => {
    getSessionUser.mockResolvedValue(null);
    expect(await getEffectiveUserId()).toBeNull();
  });

  it("returns the real user id when not impersonating", async () => {
    getSessionUser.mockResolvedValue(MEMBER);
    getCookie.mockReturnValue(undefined);

    expect(await getEffectiveUserId()).toBe("user-1");
  });

  it("returns the impersonated id for an admin with the cookie set", async () => {
    getSessionUser.mockResolvedValue(ADMIN);
    setCookie({ userId: "user-1", email: "user@example.com" });

    expect(await getEffectiveUserId()).toBe("user-1");
  });
});
