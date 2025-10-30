export type BackgroundType = "solid" | "gradient" | "image";

export interface PortalLoginConfig {
  // Visual
  backgroundType: BackgroundType;
  backgroundColor: string;
  gradientStart: string;
  gradientEnd: string;
  backgroundImage: string;
  blurEffect: boolean;
  primaryColor: string;
  borderRadius: number;
  opacity: number; // 0-100
  font: string;
  showLogo: boolean;
  logoUrl: string;
  logoSize: number; // largura em px da logo
  showTitle: boolean;
  title: string;
  showSubtitle: boolean;
  subtitle: string;
  cardShadow: boolean;

  // Autenticação - provedores
  enableFacebook: boolean;
  enableGoogle: boolean;
  enableInstagram: boolean;
  enableSMS: boolean;
  enableEmail: boolean;
  enableVoucher: boolean;
  enableForm: boolean;

  // Credenciais OAuth
  facebookAppId: string;
  facebookAppSecret: string;
  googleClientId: string;
  googleClientSecret: string;

  // Campos do formulário
  fields: {
    fullName: boolean;
    email: boolean;
    phone: boolean;
    birthDate: boolean;
    cpf: boolean;
    gender: boolean;
    postalCode: boolean;
    company: boolean;
    jobTitle: boolean;
  };

  // Validações
  validateEmail: boolean;
  validateCpf: boolean;
  validatePhone: boolean;
  uniqueEmail: boolean;

  // Sessão
  sessionMinutes: number;
  bandwidthLimitMbps: number;
  downloadLimitGb: number;
  autoReconnect: boolean;
  allowMultiDevice: boolean;

  // Privacidade e Termos
  requireTermsAccept: boolean;
  allowMarketingOptIn: boolean;
  analyticsEnabled: boolean;
  termsUrl: string;
  privacyUrl: string;

  // Integrações
  webhookUrl: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
  crmEnabled: boolean;

  // Redirecionamento
  redirectAfterLoginUrl: string;
  redirectAfterLogoutUrl: string;
  redirectWaitSeconds: number;
  redirectOpenNewTab: boolean;

  // Pós-login UI
  successTitle: string;
  successMessage: string;
  successShowTimer: boolean;
  successShowPromo: boolean;
  successPromoTitle: string;
  successPromoCode: string;
  successShowSocial: boolean;
  successSocialLinks: { facebook?: string; instagram?: string; twitter?: string; linkedin?: string };

  // Customização
  customCss: string;
  customJs: string;
}

export const defaultPortalLoginConfig: PortalLoginConfig = {
  // Visual
  backgroundType: "gradient",
  backgroundColor: "#1e293b",
  gradientStart: "#667eea",
  gradientEnd: "#764ba2",
  backgroundImage: "",
  blurEffect: false,
  primaryColor: "#667eea",
  borderRadius: 16,
  opacity: 95,
  font: "inter",
  showLogo: true,
  logoUrl: "",
  logoSize: 80,
  showTitle: true,
  title: "Conecte-se ao WiFi Grátis",
  showSubtitle: true,
  subtitle: "Faça login para continuar navegando",
  cardShadow: true,

  // Autenticação - provedores
  enableFacebook: true,
  enableGoogle: true,
  enableInstagram: false,
  enableSMS: true,
  enableEmail: true,
  enableVoucher: false,
  enableForm: true,

  // Credenciais OAuth
  facebookAppId: "",
  facebookAppSecret: "",
  googleClientId: "",
  googleClientSecret: "",

  // Campos do formulário
  fields: {
    fullName: true,
    email: true,
    phone: true,
    birthDate: false,
    cpf: false,
    gender: false,
    postalCode: false,
    company: false,
    jobTitle: false,
  },

  // Validações
  validateEmail: true,
  validateCpf: false,
  validatePhone: true,
  uniqueEmail: true,

  // Sessão
  sessionMinutes: 120,
  bandwidthLimitMbps: 10,
  downloadLimitGb: 5,
  autoReconnect: true,
  allowMultiDevice: false,

  // Privacidade e Termos
  requireTermsAccept: true,
  allowMarketingOptIn: false,
  analyticsEnabled: true,
  termsUrl: "https://empresa.com/termos",
  privacyUrl: "https://empresa.com/privacidade",

  // Integrações
  webhookUrl: "",
  googleAnalyticsId: "",
  facebookPixelId: "",
  crmEnabled: false,

  // Redirecionamento
  redirectAfterLoginUrl: "",
  redirectAfterLogoutUrl: "",
  redirectWaitSeconds: 3,
  redirectOpenNewTab: false,

  // Pós-login UI
  successTitle: "Conectado com Sucesso!",
  successMessage: "Aproveite sua navegação. Você está conectado à nossa rede WiFi gratuita.",
  successShowTimer: true,
  successShowPromo: true,
  successPromoTitle: "Primeira compra com 10% OFF!",
  successPromoCode: "WIFI10",
  successShowSocial: true,
  successSocialLinks: {},

  // Customização
  customCss: "",
  customJs: "",
};

export const STORAGE_KEY = "portalLoginConfig";

export function savePortalLoginConfig(config: PortalLoginConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Notificar mesma aba/SPA e outros listeners sobre atualização em tempo real
    window.dispatchEvent(new CustomEvent("portal:login-config", { detail: config }));
  } catch (err) {
    console.error("Erro ao salvar configuração do portal:", err);
  }
  // Persistência no backend (assíncrona, não bloqueante)
  try {
    (async () => {
      try {
        // import dinâmico ESM no browser para evitar require()
        const { getApiBases } = await import("../config/api");
        const controllerId = (() => {
          try {
            return Number(localStorage.getItem("portal.selectedControllerId") || "1") || 1;
          } catch (_) {
            return 1;
          }
        })();
        const { NEST_BASE } = await getApiBases();
        await fetch(`${NEST_BASE}/controllers/${controllerId}/portal-login-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config)
        });
      } catch (_err) {
        // silencioso: fallback é localStorage
      }
    })();
  } catch (_) {
    // silencioso
  }
}

export function loadPortalLoginConfig(): PortalLoginConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPortalLoginConfig;
    const parsed = JSON.parse(raw);
    return {
      ...defaultPortalLoginConfig,
      ...parsed,
    } as PortalLoginConfig;
  } catch (err) {
    console.warn("Falha ao carregar configuração do portal, usando padrão.", err);
    return defaultPortalLoginConfig;
  }
}

// Nova: sincronizar a configuração do backend e espelhar em localStorage
export async function syncPortalLoginConfigFromBackend(): Promise<void> {
  try {
    // import dinâmico ESM no browser
    const { getApiBases } = await import("../config/api");
    const { NEST_BASE } = await getApiBases();

    // Resolver controllerId: querystring > localStorage > listar controllers > 1
    let controllerId = (() => {
      try {
        const url = new URL(window.location.href);
        const fromQuery = Number(url.searchParams.get("controllerId") || "0") || 0;
        if (fromQuery > 0) return fromQuery;
      } catch (_) {}
      try { return Number(localStorage.getItem("portal.selectedControllerId") || "0") || 0; } catch (_) { return 0; }
    })();

    if (!controllerId || controllerId <= 0) {
      try {
        const listRes = await fetch(`${NEST_BASE}/controllers`, { cache: "no-store" });
        if (listRes.ok) {
          const listData = await listRes.json().catch(() => ({} as any));
          if (listData && Array.isArray(listData.controllers) && listData.controllers.length) {
            controllerId = Number(listData.controllers[0].id) || 1;
          }
        }
      } catch (_) {}
    }

    if (!controllerId || controllerId <= 0) controllerId = 1;
    try { localStorage.setItem("portal.selectedControllerId", String(controllerId)); } catch (_) {}

    const res = await fetch(`${NEST_BASE}/controllers/${controllerId}/portal-login-config`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data && typeof data.config === "object") {
      const merged: PortalLoginConfig = {
        ...defaultPortalLoginConfig,
        ...data.config
      } as PortalLoginConfig;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("portal:login-config", { detail: merged }));
      } catch (_) {}
    }
  } catch (_) {
    // silencioso; se offline, permanecer com localStorage
  }
}