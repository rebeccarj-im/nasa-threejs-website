// lib/models/image.ts

export type ImageItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  center: string | null;
  photographer: string | null;
  keywords: string[];
  preview: string | null;
  sources: {
    searchHref: string | null;
    assetHref: string | null;
    metadataHref: string | null;
  };
};

export type ImageSearchResponse = {
  lib: 'image';
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
  items: ImageItem[];
};
