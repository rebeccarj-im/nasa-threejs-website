// lib/models/neows.ts

export type ApproachItem = {
  id: string;             // unique id (e.g., neo_reference_id combined with epoch)
  epoch: number;          // ms epoch
  distance_lunar: number; // lunar distances (L.D.)
  diameter_km: number;    // kilometers
  hazardous: boolean;
};

export type NeowsListResponse = {
  lib: 'neows';
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  items: ApproachItem[];
};
