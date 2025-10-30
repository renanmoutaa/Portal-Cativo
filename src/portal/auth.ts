export type LoginPayload = {
  name?: string;
  email?: string;
  phone?: string;
  acceptTerms: boolean;
  controllerId?: number;
  clientMac?: string;  // MAC do cliente (id da URL)
  apMac?: string;      // MAC do AP (ap da URL)
  ssid?: string;       // SSID (ssid da URL)
};

import { getApiBases } from "../config/api";

export async function loginUser(payload: LoginPayload): Promise<{ success: boolean; token?: string; error?: string }>{
  try {
    const { FASTAPI_BASE } = await getApiBases();
    // Obter controllerId salvo (padrão 1)
    const controllerId = (() => {
      try { return Number(localStorage.getItem("portal.selectedControllerId") || "1") || 1; } catch (_) { return 1; }
    })();
    
    // Helper: normaliza MAC (12 hex -> aa:bb:cc:dd:ee:ff)
    const normalizeMac = (input?: string | null) => {
      const s = String(input || '').trim().toLowerCase();
      if (!s) return '';
      const hex = s.replace(/[^0-9a-f]/g, '');
      if (hex.length !== 12) return s;
      const parts = hex.match(/.{1,2}/g) || [];
      return parts.join(':');
    };

    // Obter MAC do cliente da URL ou localStorage
    const clientMac = normalizeMac(payload.clientMac) || (() => {
      try { return normalizeMac(localStorage.getItem("portal.clientMac")); } catch (_) { return undefined; }
    })();
    
    // Obter MAC do AP da URL ou localStorage
    const apMac = normalizeMac(payload.apMac) || (() => {
      try { return normalizeMac(localStorage.getItem("portal.apMac")); } catch (_) { return undefined; }
    })();
    
    // Obter SSID da URL ou localStorage
    const ssid = payload.ssid || (() => {
      try { return localStorage.getItem("portal.ssid") || undefined; } catch (_) { return undefined; }
    })();
    
    const body = { 
      ...payload, 
      controllerId,
      clientMac,
      apMac,
      ssid
    };
    const res = await fetch(`${FASTAPI_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.detail || data?.error || "Falha na autenticação" };
    }
    const token = data.token as string;
    try {
      localStorage.setItem("portal.accepted", String(payload.acceptTerms));
      localStorage.setItem("portal.user", JSON.stringify({
        name: payload.name || "",
        email: payload.email || "",
        phone: payload.phone || ""
      }));
      localStorage.setItem("portal.token", token);
    } catch (_) {}
    return { success: true, token };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro de rede" };
  }
}

export function logoutUser() {
  try {
    localStorage.removeItem("portal.token");
  } catch (_) {}
}

export function isAuthenticated(): boolean {
  try {
    return Boolean(localStorage.getItem("portal.token"));
  } catch (_) {
    return false;
  }
}