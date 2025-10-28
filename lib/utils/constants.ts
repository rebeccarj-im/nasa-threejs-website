// Site & runtime constants

// Derive absolute origin (works in SSR/RSC as well)
export const APP_ORIGIN =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_ORIGIN
    ? process.env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, '')
    : typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000';

export const REQ_TIMEOUT_MS = 20000; // Client-side request timeout (ms)

export const DEFAULT_PAGE_SIZE = 24;

export const OG_DEFAULT_TITLE = 'Cosmos Oracle • Share & Explore';
