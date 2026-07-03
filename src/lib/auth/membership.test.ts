import { describe, expect, it } from "vitest";
import { resolveMembershipAccess } from "./membership";

describe("resolveMembershipAccess", () => {
  it("is unauthenticated when there is no userId", () => {
    expect(resolveMembershipAccess(null, [], "tenant-1")).toBe("unauthenticated");
  });

  it("is forbidden when the user has no memberships at all", () => {
    expect(resolveMembershipAccess("user-1", [], "tenant-1")).toBe("forbidden");
  });

  it("is forbidden when the user belongs to a different tenant", () => {
    const memberships = [{ tenantId: "tenant-2" }];
    expect(resolveMembershipAccess("user-1", memberships, "tenant-1")).toBe("forbidden");
  });

  it("is authorized when the user has a membership for this tenant", () => {
    const memberships = [{ tenantId: "tenant-2" }, { tenantId: "tenant-1" }];
    expect(resolveMembershipAccess("user-1", memberships, "tenant-1")).toBe("authorized");
  });
});
