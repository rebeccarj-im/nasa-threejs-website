# Cosmos Oracle

A lightweight **Next.js + TypeScript** playground for exploring space data with a clean UI, shareable overlays, and a playful 3D landing. It pulls together an **Image Library**, **NASA DONKI** solar events, and **NeoWs** near-Earth object approaches, with first-class **sharing**, **telemetry**, and **tests**.

> Tech stack: Next.js · React · Tailwind CSS · three.js / @react-three/fiber / drei · Vitest · Playwright · MSW

---

## ✨ Features

- **3D Landing (“ThreeCards”)**
  - Interactive, responsive cards via `@react-three/fiber` + `drei` (RoundedBox, Stars, Environment, OrbitControls).
  - Suspense-powered loader with `useProgress`.

- **Image Library**
  - NASA imagery list with tags/metadata, preview, and **Visual Analysis** (dominant palette + luminance histogram).
  - Share overlay with native share / clipboard fallback.

- **DONKI & NeoWs**
  - Compact list models with type-safe overlays:
    - **DONKI**: flares (class band parsing, timeline) & CME (speed/direction badge).
    - **NeoWs**: approach visuals (orbit sketch, distance meter, size scale).
  - One-click sharing and source links.

- **Sharing**
  - `/api/share/create` short-link flow with robust fallbacks.
  - Consistent analytics events:
    - `share_open`, `share_copy` (supports `shortId`), `share_system` (requires `shortId`).
    - `social_click` with strict `network` typing.

- **Telemetry (dev/test)**
  - MSW-backed mock `/api/telemetry/event` with an in-memory buffer for assertions.

- **A11y & UX**
  - Focus trapping, ESC to close, visible focus rings, reduced-motion support.
  - Dark mode via `prefers-color-scheme` and optional `.dark` class.

---

## 📦 Project Structure (excerpt)

```
components/
  overlay/
    DonkiOverlay.tsx
    ImageOverlay.tsx
    NeowsOverlay.tsx
    ShareOverlay.tsx
  three/
    ThreeCards.tsx
lib/
  api/
    client.ts
  models/
    donki.ts
    neows.ts
  utils/
    constants.ts
pages|app/
  api/
    share/create (your implementation)
public/
  textures/
    nebula.jpg
    sun.jpg
    asteroid.jpg
tests/
  e2e/            # Playwright (excluded from Vitest)
  mocks/handlers.ts
  setup.ts
  unit/utils.spec.ts
vitest.config.ts
tailwind.css
```

---

## 🛠️ Setup

### 1) Requirements
- Node.js 18+ (recommended 20+)
- pnpm / npm / yarn

### 2) Install
```bash
pnpm i
# or
npm i
# or
yarn
```

### 3) Environment variables
Create `.env.local` with (adjust to your origin):

```bash
APP_ORIGIN=http://localhost:3000
REQ_TIMEOUT_MS=15000
```

> `APP_ORIGIN` is used to build absolute URLs for short links in SSR contexts.

### 4) Dev server
```bash
pnpm dev
# http://localhost:3000
```

---

## ▶️ Scripts

```jsonc
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:ui": "vitest",
  "test:e2e": "playwright test"
}
```

- **Vitest** runs unit/component tests with **jsdom** & a custom setup (`tests/setup.ts`).
- **Playwright** is intended for e2e; those specs are excluded from Vitest via `vitest.config.ts`.

---

## 🧪 Testing

### Vitest
- Config: `vitest.config.ts`  
- Setup: `tests/setup.ts`
  - Polyfills `ResizeObserver`
  - Mocks `navigator.clipboard`
  - Mocks `fetch` for `/api/share/create` and `/api/telemetry/event`

Run:
```bash
pnpm test
# or open UI
pnpm test:ui
```

### MSW (Mock Service Worker)
- Handlers: `tests/mocks/handlers.ts`
  - Short-link creation with optional `fail`/`delay` via query/body toggles.
  - Telemetry endpoint with in-memory buffer & GET inspector.
  - Sample data endpoints for DONKI/NeoWs/Image Library.

### Playwright (optional e2e)
Example test (translated) lives outside Vitest include:
```ts
// e2e/donki-share.spec.ts
```
Run:
```bash
pnpm test:e2e
```

---

## 🎨 Styling

- Tailwind CSS with a curated `tailwind.css`:
  - Dark mode support (media + `.dark`)
  - Improved selection color, visible focus, reduced motion
  - Utilities: line clamp, aspect ratio (no plugin), skeleton shimmer
  - Subtle card-hover, minimal custom scrollbars

---

## 🧩 Type Safety & Analytics

- The analytics `sendEvent` expects strict shapes:
  - `share_system` **requires** `shortId`.
  - `share_copy` allows `shortId` (string), and expects a **string** `itemId`.
  - `social_click` requires `network` in the union `'reddit' | 'instagram' | 'x'`.
- Components **normalize** values (e.g., `itemId ?? 'unknown'`, `shortId ?? ''`) to satisfy exact types.

---

## 🔗 Sharing Flow

- Client calls `createShortLink({ type, id, title, url? })`:
  - Server may return `{ url }`, `{ shortUrl }`, or `{ shortId }`.
  - Client normalizes to `{ url: string }`. If only `shortId` is returned:
    - Browser → relative `/s/:id`
    - SSR → `${APP_ORIGIN}/s/:id`
- Overlays support:
  - Native share via `navigator.share`
  - Clipboard fallback via `navigator.clipboard.writeText`
  - Copy/system share analytics with correct payloads

---

## ♿ Accessibility

- Focus trap within overlays, ESC to close, proper roles/labels.
- `:focus-visible` outline complements Tailwind’s `focus:ring`.
- Reduced motion: respects `prefers-reduced-motion`.

---

## ⚙️ Performance Notes

- Canvas thumbnails/visuals are lightweight (no heavy gradients).
- Histogram/palette analysis downscales images and samples sparsely.
- Three.js scene avoids shadows, uses simple materials and small counts.

---

## 🐞 Troubleshooting

- **Type errors on analytics events**  
  Ensure you pass all required fields:
  - `share_system`: `{ type: 'share_system', lib, itemId: string, shortId: string }`
  - `share_copy`: `{ type: 'share_copy', lib, itemId: string, shortId?: string }`
  - `social_click`: `{ type: 'social_click', network: 'reddit' | 'instagram' | 'x' }`

- **Short link not showing absolute URL in SSR**  
  Set `APP_ORIGIN` and ensure the server returns at least one of `url | shortUrl | shortId`.

- **Playwright test races**  
  If the share input still shows “Preparing/Creating…”, add a wait/assertion for it to resolve or mock `/api/share/create` with MSW.

---

## 📄 License

MIT — do what you will, attribution appreciated.

---

## 🙌 Thanks

NASA for public APIs and imagery.  
Community: drei, R3F, Vitest, Playwright, MSW, Tailwind.
