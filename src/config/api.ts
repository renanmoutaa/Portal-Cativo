export type ApiBases = { FASTAPI_BASE: string; NEST_BASE: string };

function getWindowInfo() {
  const hasWindow = typeof window !== "undefined";
  const origin = hasWindow ? window.location.origin : "http://localhost";
  const hostname = hasWindow ? window.location.hostname : "localhost";
  const protocol = hasWindow ? window.location.protocol : "http:";
  return { origin, hostname, protocol };
}

// Cache simples para evitar sondagens repetidas
let cachedBases: ApiBases | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000; // 30s

async function probe(url: string, path: string = "/health"): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${url}${path}`, { cache: "no-store", signal: controller.signal });
    clearTimeout(t);
    return !!res && res.ok;
  } catch (_) {
    return false;
  }
}

export async function getApiBases(): Promise<ApiBases> {
  const now = Date.now();
  if (cachedBases && now - cachedAt < CACHE_TTL_MS) return cachedBases;

  const { origin, hostname } = getWindowInfo();
  const isDev = (
    typeof import.meta !== "undefined" && (import.meta as any)?.env?.DEV
  ) || hostname === "localhost" || hostname === "127.0.0.1";

  const devFast = `http://${hostname}:4001`;
  const devNest = `http://${hostname}:4002`;
  const proxyFast = `${origin}/api/fastapi`;
  const proxyNest = `${origin}/api/nest`;

  // Ordem de preferência: dev direto → proxy via Nginx → fallback localhost
  let fast = devFast;
  let nest = devNest;

  if (isDev) {
    const okDev = await probe(devFast);
    if (!okDev) {
      const okProxy = await probe(proxyFast);
      if (okProxy) {
        fast = proxyFast;
        nest = proxyNest;
      } else {
        // Fallback: tentar localhost explícito (caso hostname seja IP da rede)
        const localFast = `http://localhost:4001`;
        if (await probe(localFast)) fast = localFast;
        const localNest = `http://localhost:4002`;
        if (await probe(localNest, "/controllers")) nest = localNest;
      }
    }
  } else {
    // Produção: preferir proxy; se falhar, tentar dev direto
    fast = proxyFast; nest = proxyNest;
    const okProxy = await probe(proxyFast);
    if (!okProxy) {
      if (await probe(devFast)) { fast = devFast; nest = devNest; }
    }
  }

  cachedBases = { FASTAPI_BASE: fast, NEST_BASE: nest };
  cachedAt = Date.now();
  return cachedBases;
}