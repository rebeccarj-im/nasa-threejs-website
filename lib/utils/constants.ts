// 站点与运行常量

// 推断绝对域名（SSR/RSC 下也能用）
export const APP_ORIGIN =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_ORIGIN
    ? process.env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, '')
    : typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000';

export const REQ_TIMEOUT_MS = 20000; // 客户端请求超时

export const DEFAULT_PAGE_SIZE = 24;

export const OG_DEFAULT_TITLE = 'Cosmos Oracle • Share & Explore';
