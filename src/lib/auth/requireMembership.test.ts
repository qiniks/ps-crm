import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("./session", () => ({ getSessionUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findMany } } }));

import { requireMembership } from "./requireMembership";

beforeEach(() => {
  getSessionUser.mockReset();
  findMany.mockReset();
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

    expect(result).toEqual({ ok: true, userId: "user-1" });
  });
});
