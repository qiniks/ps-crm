import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findMany } } }));

import { getVisibleTenantScope } from "./tenantScope";

beforeEach(() => {
  findMany.mockReset();
});

describe("getVisibleTenantScope", () => {
  it("returns an unrestricted scope for the super-admin", async () => {
    const scope = await getVisibleTenantScope({ userId: "admin-1", isSuperAdmin: true });

    expect(scope).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });

  it("scopes to the user's own tenant ids otherwise", async () => {
    findMany.mockResolvedValue([{ tenantId: "tenant-1" }, { tenantId: "tenant-2" }]);

    const scope = await getVisibleTenantScope({ userId: "user-1", isSuperAdmin: false });

    expect(scope).toEqual({ id: { in: ["tenant-1", "tenant-2"] } });
    expect(findMany).toHaveBeenCalledWith({ where: { userId: "user-1" }, select: { tenantId: true } });
  });
});
