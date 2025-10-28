// lib/models/donki.ts

/** DONKI · Flare */
export type FlareItem = {
  type: 'flare';
  id: string;
  startTime: string;               // ISO
  peakTime?: string | undefined;   // Note: undefined (not null) to support exactOptionalPropertyTypes
  classType: string;
  region?: string | null | undefined;
  note?: string | null | undefined;
};

/** DONKI · CME */
export type CMEItem = {
  type: 'cme';
  id: string;
  startTime: string;               // ISO
  speed?: number | null | undefined;     // km/s
  direction?: string | null | undefined; // e.g. "W25°" / "15°"
  note?: string | null | undefined;
};

export type DonkiMerged = FlareItem | CMEItem;

export type DonkiListResponse = {
  lib: 'donki';
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  items: DonkiMerged[];
};
