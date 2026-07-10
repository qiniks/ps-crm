import { describe, expect, it } from "vitest";
import { canManageMembers } from "./roles";

describe("canManageMembers", () => {
  it("allows an OWNER to manage membership", () => {
    expect(canManageMembers("OWNER", false)).toBe(true);
  });

  it("denies a CASHIER from managing membership", () => {
    expect(canManageMembers("CASHIER", false)).toBe(false);
  });

  it("treats an unset (null) role as manage-capable for backward compatibility", () => {
    expect(canManageMembers(null, false)).toBe(true);
  });

  it("treats an unset (undefined) role as manage-capable for backward compatibility", () => {
    expect(canManageMembers(undefined, false)).toBe(true);
  });

  it("treats a legacy pre-role value (the old 'member' default) as manage-capable", () => {
    expect(canManageMembers("member", false)).toBe(true);
  });

  it("always allows the super-admin, regardless of role", () => {
    expect(canManageMembers("CASHIER", true)).toBe(true);
    expect(canManageMembers(null, true)).toBe(true);
  });
});
