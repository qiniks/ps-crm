import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));

vi.mock("./session", () => ({ getSessionUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findMany }, tenant: { findUnique } },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getCookie }),
}));

import { requireMembership } from "./requireMembership";

beforeEach(() => {
  getSessionUser.mockReset();
  findMany.mockReset();
  findUnique.mockReset();
  getCookie.mockReset();
  getCookie.mockReturnValue(undefined);
});

describe("requireMembership", () => {
  it("returns a 401 response when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await requireMembership("tenant-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns a 404 response when the session user has no membership for this tenant", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ tenantId: "some-other-tenant" }]);

    const result = await requireMembership("tenant-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it("returns ok with the userId when the session user is a member", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ tenantId: "tenant-1" }]);

    const result = await requireMembership("tenant-1");

    expect(result).toEqual({ ok: true, userId: "user-1", isSuperAdmin: false });
  });

  it("grants the super-admin access to any existing tenant without a membership row", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    getSessionUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    findUnique.mockResolvedValue({ id: "tenant-1" });

    const result = await requireMembership("tenant-1");

    expect(result).toEqual({ ok: true, userId: "admin-1", isSuperAdmin: true });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("404s the super-admin for a tenant that doesn't exist", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    getSessionUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    findUnique.mockResolvedValue(null);

    const result = await requireMembership("no-such-tenant");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });
});
