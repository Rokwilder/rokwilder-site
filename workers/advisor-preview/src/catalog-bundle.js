// Official hunt catalog packaged into the worker. No live KV. No invented hunts.
import { loadCatalog } from './catalog-loader.js';

// Last-resort fallback if the bundle was not uploaded. Production deploys
// must include catalog-data.js from scripts/embed-catalog.mjs.
const CATALOG_URL = 'https://raw.githubusercontent.com/Rokwilder/rokwilder-site/cursor/advisor-preview-ced1/workers/advisor-preview/src/catalog.json.gz';

function b64ToAb(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cached = null;
let how = null;

export function catalogHow() {
  return how;
}

export function resetCatalogCache() {
  cached = null;
  how = null;
}

export async function officialCatalog() {
  if (cached) return cached;
  try {
    const { CATALOG_GZ_B64 } = await import('./catalog-data.js');
    if (CATALOG_GZ_B64) {
      cached = await loadCatalog(b64ToAb(CATALOG_GZ_B64));
      how = 'bundled';
      return cached;
    }
  } catch (e) {
    // Bundle missing in this deploy. Fall through.
  }
  const r = await fetch(CATALOG_URL);
  if (!r.ok) throw new Error('catalog fetch failed');
  cached = await loadCatalog(await r.arrayBuffer());
  how = 'github-fallback';
  return cached;
}
