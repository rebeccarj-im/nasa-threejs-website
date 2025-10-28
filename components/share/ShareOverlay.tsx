// components/overlay/ShareOverlay.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { sendEvent } from '@/lib/analytics';

type ImageItem = {
  id: string;
  title: string;
  description: string | null;
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

type Lib = 'image' | 'donki' | 'neows';

type ShareTrack = {
  /** Resource id (imageId / flareId / approachId) */
  itemId?: string;
  /** Short-link id to attribute shares */
  shortId?: string;
};

type Props = {
  /** Which library this share is for (kept for your analytics context) */
  lib: Lib;

  open: boolean;
  onClose: () => void;

  /** Provide a ready-to-share link & title (recommended) */
  url?: string;
  title?: string;

  /** Or pass an item to fill the title (no short-link creation in this component) */
  item?: ImageItem | null;

  /** Optional analytics context */
  track?: ShareTrack;
};

export default function ShareOverlay({
  lib,
  open,
  onClose,
  url,
  title,
  item,
  track,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevActive = useRef<Element | null>(null);

  // Compute final title & URL (fallback to current location)
  const finalTitle = useMemo<string>(() => {
    if (typeof title === 'string' && title.length > 0) return title;
    if (item?.title) return item.title;
    return 'Shared via Cosmos Oracle';
  }, [title, item?.title]);

  const finalUrl = useMemo<string>(() => {
    if (typeof url === 'string' && url.length > 0) return url;
    if (typeof window !== 'undefined' && window.location?.href) return window.location.href;
    return 'https://example.com';
  }, [url]);

  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function';

  // Normalize analytics fields to satisfy strict types
  const analyticsItemId = useMemo<string>(() => track?.itemId ?? 'unknown', [track?.itemId]);
  const analyticsShortId = useMemo<string>(() => {
    // prefer provided shortId; otherwise derive from the finalUrl; always return a string
    const s = track?.shortId ?? extractShortId(finalUrl);
    return s || '';
  }, [track?.shortId, finalUrl]);

  // When opened: capture focus, lock scroll, focus Copy, and fire "share_open"
  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => copyBtnRef.current?.focus(), 0);

    // Analytics: share_open
    sendEvent({
      type: 'share_open',
      lib,
      itemId: analyticsItemId,
    });

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      if (prevActive.current instanceof HTMLElement) prevActive.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard: Esc to close, Tab to trap focus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, containerRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleMaskClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(finalUrl);
        toast('Link copied');
      } else {
        toast(finalUrl);
      }
      // Analytics: share_copy (include required fields; keep as strings)
      sendEvent({
        type: 'share_copy',
        lib,
        itemId: analyticsItemId,
        shortId: analyticsShortId,
      });
    } catch {
      toast('Copy failed');
    }
  }, [finalUrl, lib, analyticsItemId, analyticsShortId]);

  const handleSystemShare = useCallback(async () => {
    if (!canWebShare) return;
    try {
      await (navigator as any).share({
        title: finalTitle,
        text: 'Explore with Cosmos Oracle',
        url: finalUrl,
      });
      // Analytics: share_system (schema requires shortId)
      sendEvent({
        type: 'share_system',
        lib,
        itemId: analyticsItemId,
        shortId: analyticsShortId,
      });
    } catch {
      // User cancelled or failed → ignore
    }
  }, [canWebShare, finalTitle, finalUrl, lib, analyticsItemId, analyticsShortId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onClick={handleMaskClick}
    >
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-[10vh] mx-auto w-[min(560px,92vw)] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-semibold">Share</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-5 py-4">
          {/* Link row */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Share link
            </label>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={finalUrl}
                className="w-full truncate rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
              />
              <button
                ref={copyBtnRef}
                onClick={handleCopy}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Copy
              </button>
              {canWebShare && (
                <button
                  onClick={handleSystemShare}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Share
                </button>
              )}
            </div>
          </div>

          {/* Social web share links */}
          <div className="rounded-md border bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700">Share to social</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SocialLinkTracked
                name="Reddit"
                href={`https://www.reddit.com/submit?url=${encodeURIComponent(
                  finalUrl
                )}&title=${encodeURIComponent(finalTitle)}`}
                network="reddit"
              />
              <SocialLinkTracked
                name="X / Twitter"
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                  finalUrl
                )}&text=${encodeURIComponent(finalTitle)}`}
                network="x"
              />
              {/* Untracked links (analytics schema only allows 'reddit' | 'instagram' | 'x') */}
              <SocialLink
                name="Facebook"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  finalUrl
                )}`}
              />
              <SocialLink
                name="LinkedIn"
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                  finalUrl
                )}&title=${encodeURIComponent(finalTitle)}`}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Instagram does not support web share links. Use the system share sheet or the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

// Only the networks allowed by your Analytics SocialClickEvent type
type TrackedNetwork = 'reddit' | 'instagram' | 'x';

function SocialLinkTracked({
  name,
  href,
  network,
}: {
  name: string;
  href: string;
  network: TrackedNetwork;
}) {
  const onClick = useCallback(() => {
    sendEvent({
      type: 'social_click',
      network, // strictly 'reddit' | 'instagram' | 'x'
    });
  }, [network]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      data-network={network}
      className="rounded border bg-white px-3 py-2 text-center text-sm hover:bg-gray-50"
    >
      {name}
    </a>
  );
}

function SocialLink({
  name,
  href,
}: {
  name: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded border bg-white px-3 py-2 text-center text-sm hover:bg-gray-50"
    >
      {name}
    </a>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;

  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
  );
  if (nodes.length === 0) return;

  const first = nodes.item(0);
  const last = nodes.item(nodes.length - 1);
  if (!first || !last) return;

  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey && active === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && active === last) {
    first.focus();
    e.preventDefault();
  }
}

function toast(msg: string) {
  try {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;z-index:2000;opacity:0;transition:opacity .2s';
    document.body.appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = '0.95'));
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 240);
    }, 1600);
  } catch {}
}

/** Extract a short id from URL like `/s/abc123` → "abc123". Always returns a string. */
function extractShortId(u?: string | null): string {
  if (!u) return '';
  try {
    // Support absolute or relative URLs
    const url = new URL(u, 'http://dummy.base');
    const m = url.pathname.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  } catch {
    const m = u.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  }
}
