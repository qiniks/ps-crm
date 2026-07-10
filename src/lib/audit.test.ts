import { describe, expect, it } from "vitest";
import { buildAuditEntry, shiftCloseMetadata } from "./audit";

describe("buildAuditEntry", () => {
  it("defaults missing optional fields to null", () => {
    expect(buildAuditEntry({ action: "session.stop" })).toEqual({
      tenantId: null,
      actorUserId: null,
      actorEmail: null,
      action: "session.stop",
      targetType: null,
      targetId: null,
      metadata: null,
    });
  });

  it("trims the action string", () => {
    expect(buildAuditEntry({ action: "  shift.close  " }).action).toBe("shift.close");
  });

  it("throws when the action is empty", () => {
    expect(() => buildAuditEntry({ action: "   " })).toThrow();
  });

  it("passes through provided fields", () => {
    const entry = buildAuditEntry({
      tenantId: "t1",
      actorUserId: "u1",
      actorEmail: "a@example.com",
      action: "station.delete",
      targetType: "Station",
      targetId: "s1",
      metadata: { name: "PS5 #1" },
    });
    expect(entry).toEqual({
      tenantId: "t1",
      actorUserId: "u1",
      actorEmail: "a@example.com",
      action: "station.delete",
      targetType: "Station",
      targetId: "s1",
      metadata: { name: "PS5 #1" },
    });
  });

  it("drops undefined values out of metadata", () => {
    const entry = buildAuditEntry({
      action: "shift.close",
      metadata: { difference: -200, note: undefined },
    });
    expect(entry.metadata).toEqual({ difference: -200 });
  });
});

describe("shiftCloseMetadata", () => {
  it("flags a shortage when counted cash is below expected", () => {
    expect(
      shiftCloseMetadata({ openingCash: 1000, closingCash: 1500, expectedCash: 1700 })
    ).toEqual({
      openingCash: 1000,
      closingCash: 1500,
      expectedCash: 1700,
      difference: -200,
      hasShortage: true,
    });
  });

  it("does not flag a shortage on an exact match or a surplus", () => {
    expect(
      shiftCloseMetadata({ openingCash: 1000, closingCash: 1700, expectedCash: 1700 }).hasShortage
    ).toBe(false);
    expect(
      shiftCloseMetadata({ openingCash: 1000, closingCash: 1800, expectedCash: 1700 }).hasShortage
    ).toBe(false);
  });
});
