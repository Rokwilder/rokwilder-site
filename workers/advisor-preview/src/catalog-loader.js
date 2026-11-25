let cached = null;

export async function loadCatalog(gzBytes) {
  if (cached) return cached;
  if (typeof gzBytes === 'string') {
    cached = JSON.parse(gzBytes);
    return cached;
  }
  const bytes = gzBytes instanceof ArrayBuffer ? new Uint8Array(gzBytes) : new Uint8Array(gzBytes);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const raw = await new Response(stream).text();
  cached = JSON.parse(raw);
  return cached;
}

export function clearCatalogCache() { cached = null; }
