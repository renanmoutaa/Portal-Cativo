import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "./auth";
import { loadPortalLoginConfig, PortalLoginConfig, STORAGE_KEY, syncPortalLoginConfigFromBackend, savePortalLoginConfig } from "./config";
import { sanitizeRedirectUrl, isConnectivityCheckUrl } from "./url";
import { Wifi } from "lucide-react";

export default function LoginPortal() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PortalLoginConfig>(loadPortalLoginConfig());
  
  // Capturar parâmetros da URL de redirecionamento da UniFi
  const [unifiParams, setUnifiParams] = useState<{
    ap?: string;       // MAC do AP
    id?: string;       // MAC do cliente
    t?: string;        // Timestamp
    url?: string;      // URL original
    ssid?: string;     // SSID
  }>({});

  // Nova: sincroniza com backend na montagem
  useEffect(() => {
    (async () => {
      await syncPortalLoginConfigFromBackend();
      setConfig(loadPortalLoginConfig());
    })();
  }, []);
  
  // Capturar parâmetros da URL de redirecionamento da UniFi
  useEffect(() => {
    try {
      // Helper: normaliza MAC (12 hex -> aa:bb:cc:dd:ee:ff)
      const normalizeMac = (input?: string | null) => {
        const s = String(input || '').trim().toLowerCase();
        if (!s) return '';
        const hex = s.replace(/[^0-9a-f]/g, '');
        if (hex.length !== 12) return s;
        const parts = hex.match(/.{1,2}/g) || [];
        return parts.join(':');
      };

      // Obter parâmetros da URL
      const urlParams = new URLSearchParams(window.location.search);
      
      // Verificar se há parâmetros na URL
      const hasParams = urlParams.has('ap') || urlParams.has('id') || urlParams.has('t') || 
                        urlParams.has('url') || urlParams.has('ssid');
      
      // Se não houver parâmetros, verificar se há parâmetros no localStorage
      if (!hasParams) {
        const storedClientMac = localStorage.getItem('portal.clientMac');
        const storedApMac = localStorage.getItem('portal.apMac');
        const storedSsid = localStorage.getItem('portal.ssid');
        const storedUrl = localStorage.getItem('portal.targetUrl');
        
        if (storedClientMac || storedApMac || storedSsid || storedUrl) {
          console.log('Usando parâmetros UniFi do localStorage');
          setUnifiParams({
            id: storedClientMac || undefined,
            ap: storedApMac || undefined,
            ssid: storedSsid || undefined,
            url: storedUrl || undefined
          });
          // Atualizar redirectAfterLoginUrl automaticamente se salvo
          if (storedUrl) {
            const cfg = loadPortalLoginConfig();
            const next = { ...cfg, redirectAfterLoginUrl: storedUrl } as PortalLoginConfig;
            // Não persistir no backend aqui para evitar sobrescrever edições do Editor
            setConfig(next);
          }
          return;
        }
      }
      
      // Processar parâmetros da URL
      const rawUrl = urlParams.get('url');
      const decodedUrl = rawUrl ? decodeURIComponent(rawUrl) : undefined;
      const params = {
        ap: normalizeMac(urlParams.get('ap')) || undefined,
        id: normalizeMac(urlParams.get('id')) || undefined,
        t: urlParams.get('t') || undefined,
        url: decodedUrl || undefined,
        ssid: urlParams.get('ssid') || undefined
      };
      
      // Armazenar parâmetros no estado e localStorage para uso posterior
      setUnifiParams(params);
      
      if (params.id) {
        localStorage.setItem('portal.clientMac', params.id);
        console.log('MAC do cliente armazenado:', params.id);
      }

      if (params.ap) {
        localStorage.setItem('portal.apMac', params.ap);
        console.log('MAC do AP armazenado:', params.ap);
      }
      
      if (params.ssid) {
        localStorage.setItem('portal.ssid', params.ssid);
        console.log('SSID armazenado:', params.ssid);
      }
      
      if (params.url) {
        const cfg = loadPortalLoginConfig();
        const safeUrl = sanitizeRedirectUrl(params.url, cfg.redirectAfterLoginUrl || undefined);
        try { localStorage.setItem('portal.targetUrl', safeUrl); } catch (_) {}
        console.log('URL de destino armazenada (sanitizada):', safeUrl);
        // Atualizar somente no estado local (sem persistir no backend) para evitar corridas
        const next = { ...cfg, redirectAfterLoginUrl: safeUrl } as PortalLoginConfig;
        setConfig(next);
      }
      
      console.log('Parâmetros UniFi capturados:', params);
    } catch (err) {
      console.error('Erro ao processar parâmetros da URL:', err);
    }
  }, []);

  // Atualizar config quando localStorage mudar (em outra aba/preview)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setConfig(loadPortalLoginConfig());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Escutar evento customizado para atualização em tempo real na mesma aba
  useEffect(() => {
    function handleLocalUpdate(e: Event) {
      const ce = e as CustomEvent<PortalLoginConfig>;
      if (ce.detail) {
        setConfig(ce.detail);
      } else {
        setConfig(loadPortalLoginConfig());
      }
    }
    window.addEventListener("portal:login-config", handleLocalUpdate as EventListener);
    return () => window.removeEventListener("portal:login-config", handleLocalUpdate as EventListener);
  }, []);

  // Loader de fontes via Google Fonts conforme config.font
  const fontFamilies: Record<string, { family: string; href: string }> = {
    inter: {
      family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    },
    roboto: {
      family: "Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
    },
    poppins: {
      family: "Poppins, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
    },
    montserrat: {
      family: "Montserrat, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
      href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
    },
    playfair: {
      family: "Playfair Display, Georgia, 'Times New Roman', serif",
      href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
    },
  };

  useEffect(() => {
    const cfg = fontFamilies[config.font] || fontFamilies["inter"];
    const id = "portal-font-link";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== cfg.href) {
      link.href = cfg.href;
    }
  }, [config.font]);

  const [acceptTerms, setAcceptTerms] = useState<boolean>(() => !config.requireTermsAccept);
  const [marketingOptIn, setMarketingOptIn] = useState<boolean>(false);

  function isEmailValid(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function onlyDigits(v: string): string {
    return v.replace(/\D/g, "");
  }
  function isPhoneValid(v: string): boolean {
    const d = onlyDigits(v);
    return d.length >= 10 && d.length <= 11;
  }

  // Este useEffect foi substituído pelo useEffect abaixo
  // e está sendo mantido apenas para referência
  // Será removido na próxima atualização

  useEffect(() => {
    const js = config?.customJs?.trim();
    if (!js || js.length === 0) return;
    
    let scriptEl: HTMLScriptElement | null = null;
    
    try {
      // Executa JS customizado de forma segura e controlada, sem injetar <script>
      const fn = new Function('"use strict";\n' + js);
      fn.call(window);
    } catch (err) {
      console.error("Erro ao executar customJs do portal:", err);
    }
    
    return () => {
      if (scriptEl) scriptEl.remove();
    };
  }, [config.customJs]);
  
  useEffect(() => {
    const css = config?.customCss?.trim();
    let styleEl: HTMLStyleElement | null = null;
    
    if (css && css.length > 0) {
      styleEl = document.createElement("style");
      styleEl.type = "text/css";
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }
    
    return () => {
      if (styleEl) styleEl.remove();
    };
  }, [config.customCss]);

  function getBackgroundStyle() {
    if (config.backgroundType === "gradient") {
      return `linear-gradient(135deg, ${config.gradientStart} 0%, ${config.gradientEnd} 100%)`;
    } else if (config.backgroundType === "image" && config.backgroundImage) {
      return `url(${config.backgroundImage})`;
    }
    return config.backgroundColor;
  }

  async function loginWithProvider(provider: "facebook" | "google") {
    setError(null);
    if (config.requireTermsAccept && !acceptTerms) {
      setError("Você precisa aceitar os Termos de Uso para continuar.");
      return;
    }
    setLoading(true);
    const demoEmail = provider === "facebook" ? "guest+facebook@portal.local" : "guest+google@portal.local";
    
    // Incluir parâmetros da UniFi no payload de login
    const loginPayload = { 
      name: `Guest via ${provider}`, 
      email: demoEmail, 
      phone: "", 
      acceptTerms,
      clientMac: unifiParams.id,
      apMac: unifiParams.ap,
      ssid: unifiParams.ssid
    };
    
    console.log(`Enviando payload de login via ${provider} com parâmetros UniFi:`, loginPayload);
    
    const res = await loginUser(loginPayload);
    setLoading(false);
    if (res.success) {
      // Sempre exibir página de Status; countdown e redirecionamento ocorrem lá
      navigate("/portal/status", { replace: true });
    } else {
      setError(res.error || "Falha na autenticação.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (config.requireTermsAccept && !acceptTerms) {
      setError("Você precisa aceitar os Termos de Uso.");
      return;
    }
    if (config.fields.email && !email && config.fields.phone && !phone) {
      setError("Informe e-mail ou telefone.");
      return;
    }
    if (config.fields.email && email && config.validateEmail && !isEmailValid(email)) {
      setError("E-mail inválido.");
      return;
    }
    if (config.fields.phone && phone && config.validatePhone && !isPhoneValid(phone)) {
      setError("Telefone inválido.");
      return;
    }

    setLoading(true);
    
    // Incluir parâmetros da UniFi no payload de login
    const loginPayload = { 
      name, 
      email, 
      phone, 
      acceptTerms,
      clientMac: unifiParams.id,
      apMac: unifiParams.ap,
      ssid: unifiParams.ssid
    };
    
    console.log('Enviando payload de login com parâmetros UniFi:', loginPayload);
    
    const res = await loginUser(loginPayload);
    setLoading(false);
    if (res.success) {
      // Caso a URL capturada seja um endpoint de checagem de conectividade, evitar tela em branco
      try {
        const raw = localStorage.getItem('portal.targetUrl');
        const safe = sanitizeRedirectUrl(raw, config.redirectAfterLoginUrl || undefined);
        localStorage.setItem('portal.targetUrl', safe);
      } catch (_) {}
      // Sempre exibir página de Status; countdown e redirecionamento ocorrem lá
      navigate("/portal/status", { replace: true });
    } else {
      setError(res.error || "Falha na autenticação.");
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: getBackgroundStyle(),
        backgroundSize: "cover",
        backgroundPosition: "center",
        backdropFilter: config.blurEffect ? "blur(10px)" : undefined,
        fontFamily: (fontFamilies[config.font]?.family || fontFamilies["inter"].family),
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <div 
        className="w-full bg-white border"
        style={{
          maxWidth: "clamp(320px, 90vw, 560px)",
          padding: "clamp(20px, 4vw, 24px)",
          borderRadius: `${config.borderRadius}px`,
          opacity: config.opacity / 100,
          boxShadow: config.cardShadow ? "0 25px 50px -12px rgba(0, 0, 0, 0.25)" : "none",
        }}
      >
        <div className="mb-6 text-center">
          {config.showLogo && (
            <div className="mb-4 flex justify-center">
              {config.logoUrl ? (
                <img 
                  src={config.logoUrl}
                  alt="Logo"
                  style={{ 
                    width: `${config.logoSize || 80}px`,
                    height: "auto",
                    borderRadius: `${config.borderRadius / 1.5}px`,
                    objectFit: "contain",
                    display: "block"
                  }}
                />
              ) : (
                <div 
                  className="w-20 h-20 mx-auto flex items-center justify-center"
                  style={{ 
                    backgroundColor: config.primaryColor,
                    borderRadius: `${config.borderRadius / 1.5}px`
                  }}
                >
                  <Wifi className="h-10 w-10 text-white" />
                </div>
              )}
            </div>
          )}

          {config.showTitle && (
            <h1 className="text-xl font-semibold">{config.title}</h1>
          )}
          {config.showSubtitle && (
            <p className="text-sm text-slate-600">{config.subtitle}</p>
          )}
        </div>

        {/* Botões como no preview */}
        <div className="space-y-3">
          {config.enableFacebook && (
            <button 
              className="w-full transition-all hover:scale-105 text-white py-2 font-medium"
              style={{ 
                backgroundColor: config.primaryColor,
                borderRadius: `${config.borderRadius / 2}px`
              }}
              onClick={() => loginWithProvider("facebook")}
              disabled={loading}
            >
              Continuar com Facebook
            </button>
          )}
          {config.enableGoogle && (
            <button 
              className="w-full transition-all hover:scale-105 border py-2 font-medium"
              style={{ borderRadius: `${config.borderRadius / 2}px` }}
              onClick={() => loginWithProvider("google")}
              disabled={loading}
            >
              Continuar com Google
            </button>
          )}
        </div>

        {/* Formulário sempre visível quando habilitado */}
        {config.enableForm && (
          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            {config.fields.fullName && (
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none"
                  style={{ outlineColor: config.primaryColor }}
                  placeholder="Seu nome"
                />
              </div>
            )}
            {config.fields.email && (
              <div>
                <label className="block text-sm font-medium mb-1">E‑mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none"
                  style={{ outlineColor: config.primaryColor }}
                  placeholder="voce@email.com"
                />
              </div>
            )}
            {config.fields.phone && (
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none"
                  style={{ outlineColor: config.primaryColor }}
                  placeholder="(DDD) 90000‑0000"
                />
              </div>
            )}

            {config.requireTermsAccept && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                Eu aceito os <a href={config.termsUrl || "/portal/terms"} className="underline" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
              </label>
            )}
            {config.allowMarketingOptIn && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
                Quero receber novidades e ofertas
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (config.requireTermsAccept && !acceptTerms)}
              className="w-full text-white rounded-md py-2 font-medium hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: config.primaryColor, borderRadius: `${config.borderRadius / 2}px` }}
            >
              {loading ? "Conectando…" : "Conectar"}
            </button>
          </form>
        )}

        <p 
          className="text-xs text-slate-500 text-center mt-6"
          style={{ fontFamily: (fontFamilies[config.font]?.family || fontFamilies["inter"].family) }}
        >
          Ao continuar, você concorda com nossos <a className="underline" href={config.termsUrl || "/portal/terms"} target="_blank" rel="noopener noreferrer">Termos de Uso</a>
        </p>

        <div className="mt-6 text-center">
          <Link to="/admin" className="text-xs text-slate-500 underline">Ir para Admin</Link>
        </div>
      </div>
    </div>
  );
}