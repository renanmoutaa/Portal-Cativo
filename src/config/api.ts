export type ApiBases = { FASTAPI_BASE: string; NEST_BASE: string };

function getWindowInfo() {
  const hasWindow = typeof window !== "undefined";
  const origin = hasWindow ? window.location.origin : "http://localhost";
  const hostname = hasWindow ? window.location.hostname : "localhost";
  const protocol = hasWindow ? window.location.protocol : "http:";
  return { origin, hostname, protocol };
}

export async function getApiBases(): Promise<ApiBases> {
  const { origin } = getWindowInfo();
  // Forçar uso de mesma origem com Nginx para unificar ambientes
  return {
    FASTAPI_BASE: `${origin}/api/fastapi`,
    NEST_BASE: `${origin}/api/nest`,
  };
}