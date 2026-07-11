import { describe, expect, it } from "vitest";
import { canDeleteRoom, canDeleteTenant, hasActiveStation } from "./deletion";

describe("hasActiveStation", () => {
  it("is false when no station is BUSY", () => {
    expect(hasActiveStation([{ status: "FREE" }, { status: "MAINTENANCE" }])).toBe(false);
  });

  it("is true when any station is BUSY", () => {
    expect(hasActiveStation([{ status: "FREE" }, { status: "BUSY" }])).toBe(true);
  });

  it("is false for an empty station list", () => {
    expect(hasActiveStation([])).toBe(false);
  });
});

describe("canDeleteRoom", () => {
  it("allows deletion when every station is free or under maintenance", () => {
    expect(canDeleteRoom([{ status: "FREE" }, { status: "MAINTENANCE" }])).toBe(true);
  });

  it("allows deletion of a room with no stations", () => {
    expect(canDeleteRoom([])).toBe(true);
  });

  it("blocks deletion when a station is mid-session (BUSY)", () => {
    expect(canDeleteRoom([{ status: "FREE" }, { status: "BUSY" }])).toBe(false);
  });
});

describe("canDeleteTenant", () => {
  it("allows deletion when no station is busy and no shift is open", () => {
    expect(
      canDeleteTenant({ stations: [{ status: "FREE" }], hasOpenShift: false })
    ).toBe(true);
  });

  it("blocks deletion when any station across the club is BUSY", () => {
    expect(
      canDeleteTenant({ stations: [{ status: "BUSY" }], hasOpenShift: false })
    ).toBe(false);
  });

  it("blocks deletion when a cash-register shift is open, even with no busy stations", () => {
    expect(
      canDeleteTenant({ stations: [{ status: "FREE" }], hasOpenShift: true })
    ).toBe(false);
  });

  it("blocks deletion when both a station is busy and a shift is open", () => {
    expect(
      canDeleteTenant({ stations: [{ status: "BUSY" }], hasOpenShift: true })
    ).toBe(false);
  });

  it("allows deletion of a club with no rooms/stations and no open shift", () => {
    expect(canDeleteTenant({ stations: [], hasOpenShift: false })).toBe(true);
  });
});
