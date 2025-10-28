/* scripts/seed.ts
 * 预热接口 & 生成示例短链
 * 用法：
 *  APP_ORIGIN="http://localhost:3000" npx tsx scripts/seed.ts
 *  npx tsx scripts/seed.ts --host http://localhost:3000
 */

type ImageItem = {
  id: string; title: string; preview: string | null;
  sources?: { assetHref?: string | null };
};
type DonkiItem = { id: string; title: string; kind: string };
type NeowsItem = { id: string; epoch: number; hazardous: boolean };

type ImageResp = {
  lib: 'image'; page: number; pageSize: number; hasMore: boolean; items: ImageItem[];
};
type DonkiResp = {
  lib: 'donki'; page: number; pageSize: number; hasMore: boolean; items: DonkiItem[];
};
type NeowsResp = {
  lib: 'neows'; page: number; pageSize: number; hasMore: boolean; items: NeowsItem[];
};

const argsHost = (() => {
  const idx = process.argv.indexOf('--host');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
})();

const APP_ORIGIN =
  argsHost ||
  process.env.APP_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  'http://localhost:3000';

const TIMEOUT = 25_000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function getJSON<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${APP_ORIGIN}${path}`;
  const res = await withTimeout(fetch(url, { headers: { Accept: 'application/json' } }));
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const url = path.startsWith('http') ? path : `${APP_ORIGIN}${path}`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }));
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST ${url} -> ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function logSection(title: string) {
  console.log('\n' + '─'.repeat(8) + ' ' + title + ' ' + '─'.repeat(8));
}

async function main() {
  console.log(`Seed start → ${APP_ORIGIN}`);

  /* 1) 预热 Image Library */
  logSection('Warmup: Image Library');
  const images = await getJSON<ImageResp>(`/api/data/image?page=1&q=nebula`);
  console.log(`Image page=${images.page} items=${images.items.length} hasMore=${images.hasMore}`);
  const img = images.items[0];
  if (img) {
    const shareImg = await postJSON<{ shortUrl?: string; url?: string; shortId?: string }>(
      '/api/share/create',
      {
        type: 'image',
        id: img.id,
        title: img.title,
        url: `${APP_ORIGIN}/gallery/ring?lib=image&q=nebula`,
      }
    );
    const imgUrl = shareImg.shortUrl || shareImg.url || (shareImg.shortId ? `${APP_ORIGIN}/s/${shareImg.shortId}` : '');
    console.log('Image short link:', imgUrl || '(fallback failed)');
  } else {
    console.log('No image items returned.');
  }

  /* 2) 预热 DONKI */
  logSection('Warmup: DONKI');
  const donki = await getJSON<DonkiResp>(`/api/data/donki?page=1&limit=24`);
  console.log(`DONKI page=${donki.page} items=${donki.items.length} hasMore=${donki.hasMore}`);
  const d0 = donki.items[0];
  if (d0) {
    const shareD = await postJSON<{ shortUrl?: string; url?: string; shortId?: string }>(
      '/api/share/create',
      {
        type: 'donki',
        id: d0.id,
        title: d0.title,
        url: `${APP_ORIGIN}/gallery/ring?lib=donki`,
      }
    );
    const dUrl = shareD.shortUrl || shareD.url || (shareD.shortId ? `${APP_ORIGIN}/s/${shareD.shortId}` : '');
    console.log('DONKI short link:', dUrl || '(fallback failed)');
  } else {
    console.log('No DONKI items returned.');
  }

  /* 3) 预热 NeoWs */
  logSection('Warmup: NeoWs');
  const neows = await getJSON<NeowsResp>(`/api/data/neows?page=1&limit=24`);
  console.log(`NeoWs page=${neows.page} items=${neows.items.length} hasMore=${neows.hasMore}`);
  const n0 = neows.items[0];
  if (n0) {
    const title = `NEO ${n0.id} · ${new Date(n0.epoch).toISOString().slice(0, 16)}Z`;
    const shareN = await postJSON<{ shortUrl?: string; url?: string; shortId?: string }>(
      '/api/share/create',
      {
        type: 'neows',
        id: n0.id,
        title,
        url: `${APP_ORIGIN}/gallery/ring?lib=neows`,
      }
    );
    const nUrl = shareN.shortUrl || shareN.url || (shareN.shortId ? `${APP_ORIGIN}/s/${shareN.shortId}` : '');
    console.log('NeoWs short link:', nUrl || '(fallback failed)');
  } else {
    console.log('No NeoWs items returned.');
  }

  /* 总结 */
  logSection('Done');
  console.log('Seed finished successfully.\n');
}

main().catch((err) => {
  console.error('\nSeed failed:', err?.message || err);
  process.exitCode = 1;
});
