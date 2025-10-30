// Utilitários para sanitizar URLs de redirecionamento pós-login

const blockedPatterns: RegExp[] = [
  /\/generate_204(?:\b|$)/i,
  /connectivitycheck\.(?:gstatic|android)\.com\/.*/i,
  /clients3\.google\.com\/generate_204/i,
  /msftncsi\.com\/ncsi\.txt/i,
  /hotspot\-detect\.html/i,
  /apple\.com\/library\/test\/success\.html/i,
];

export function isConnectivityCheckUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = url.toString();
    return blockedPatterns.some((re) => re.test(u));
  } catch (_) {
    return false;
  }
}

export function sanitizeRedirectUrl(url?: string | null, fallback?: string): string {
  const safeFallback = (fallback || "https://www.google.com").trim();
  if (!url) return safeFallback;
  try {
    const u = url.toString().trim();
    if (isConnectivityCheckUrl(u)) return safeFallback;
    return u;
  } catch (_) {
    return safeFallback;
  }
}