export type ApiBases = { FASTAPI_BASE: string; NEST_BASE: string };

function getWindowInfo() {
  const hasWindow = typeof window !== "undefined";
  const origin = hasWindow ? window.location.origin : "http://localhost";
  const hostname = hasWindow ? window.location.hostname : "localhost";
  const protocol = hasWindow ? window.location.protocol : "http:";
  return { origin, hostname, protocol };
}

// Cache simples para evitar recomputar bases
let cachedBases: ApiBases | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000; // 30s

export async function getApiBases(): Promise<ApiBases> {
  const now = Date.now();
  if (cachedBases && now - cachedAt < CACHE_TTL_MS) return cachedBases;

  const { origin } = getWindowInfo();
  // Padronizar: sempre usar proxies via Nginx
  const fast = `${origin}/api/fastapi`;
  const nest = `${origin}/api/nest`;

  cachedBases = { FASTAPI_BASE: fast, NEST_BASE: nest };
  cachedAt = Date.now();
  return cachedBases;
}