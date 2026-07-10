import type { TariffKind } from "./tariffs";

export type ActiveSession = {
  id: string;
  tariffKind: TariffKind;
  startedAt: string;
  plannedEndAt: string | null;
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
  stations: StationDTO[];
};
