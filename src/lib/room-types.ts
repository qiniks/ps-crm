import type { TariffKind } from "./tariffs";

// Floor-plan canvas height preset. Console positions are percentages of the
// canvas, so a taller preset spreads out an otherwise-cramped layout with
// many consoles — shared by the editor and the live room view so both
// render the room at the same size.
export const ROOM_CANVAS_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type RoomCanvasSize = (typeof ROOM_CANVAS_SIZES)[number];
export const ROOM_CANVAS_HEIGHT: Record<RoomCanvasSize, number> = {
  SMALL: 360,
  MEDIUM: 520,
  LARGE: 720,
};
export function isRoomCanvasSize(value: unknown): value is RoomCanvasSize {
  return typeof value === "string" && (ROOM_CANVAS_SIZES as readonly string[]).includes(value);
}

export type ActiveSession = {
  id: string;
  tariffKind: TariffKind;
  startedAt: string;
  plannedEndAt: string | null;
  // The session's actual accumulated cost — for a fixed tariff this can grow
  // past the tariff's base price via an extension (see POST
  // /api/sessions/[id]/extend), so displays must use this rather than
  // re-deriving a fresh `fixedPrice(room, tariffKind)`.
  cost: number;
  customerId: string | null;
  customerName: string | null;
  customerBalance: number | null;
};

export type StationDTO = {
  id: string;
  name: string;
  type: string;
  status: string;
  posX: number;
  posY: number;
  activeSession: ActiveSession | null;
};

export type RoomDTO = {
  id: string;
  name: string;
  club: { id: string; name: string };
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
  canvasSize: RoomCanvasSize;
  stations: StationDTO[];
};
