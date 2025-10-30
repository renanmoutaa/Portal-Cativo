import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAuthenticated, logoutUser } from "./auth";
import { loadPortalLoginConfig, PortalLoginConfig, STORAGE_KEY } from "./config";
import { sanitizeRedirectUrl, isConnectivityCheckUrl } from "./url";
import { CheckCircle, Facebook, Instagram, Twitter, Linkedin } from "lucide-react";

export default function StatusPortal() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PortalLoginConfig>(() => loadPortalLoginConfig());
  const [secondsLeft, setSecondsLeft] = useState<number>(() => Math.max(0, (loadPortalLoginConfig().redirectWaitSeconds || 0)));
  const [connected, setConnected] = useState<boolean>(false);

  // Determina modo preview via rota ou query (?preview=1)
  const isPreviewMode = (() => {
    try {
      const pathname = window.location.pathname || "";
      const urlParams = new URLSearchParams(window.location.search);
      return pathname.includes("/portal/status-preview") || urlParams.get("preview") === "1";
    } catch (_) {
      return false;
    }
  })();

  // Carrega fonte como no Login
  useEffect(() => {
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

  // Atualizar config via storage e evento customizado para preview em tempo real
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setConfig(loadPortalLoginConfig());
      }
    }
    function handleLocalUpdate(e: Event) {
      const ce = e as CustomEvent<PortalLoginConfig>;
      if (ce.detail) {
        setConfig(ce.detail);
      } else {
        setConfig(loadPortalLoginConfig());
      }
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("portal:login-config", handleLocalUpdate as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("portal:login-config", handleLocalUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    const ok = isAuthenticated();
    setConnected(ok);
    if (!ok && !isPreviewMode) {
      navigate("/portal/login", { replace: true });
      return;
    }
    setConfig(loadPortalLoginConfig());

    const total = Math.max(0, (config.redirectWaitSeconds || 0));
    if (total > 0) setSecondsLeft(total);
    let timer: number | undefined;
    const targetUrl = (() => {
      try {
        const raw = (localStorage.getItem('portal.targetUrl') || config.redirectAfterLoginUrl || '').trim();
        return sanitizeRedirectUrl(raw, config.redirectAfterLoginUrl || undefined);
      } catch (_) {
        return sanitizeRedirectUrl((config.redirectAfterLoginUrl || '').trim());
      }
    })();
    if (targetUrl) {
      timer = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            window.clearInterval(Number(timer));
            if (!isPreviewMode) performRedirect();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(Number(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  function performRedirect() {
    const url = (() => {
      try {
        const raw = (localStorage.getItem('portal.targetUrl') || config.redirectAfterLoginUrl || '').trim();
        return sanitizeRedirectUrl(raw, config.redirectAfterLoginUrl || undefined);
      } catch (_) {
        return sanitizeRedirectUrl((config.redirectAfterLoginUrl || '').trim());
      }
    })();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      if (config.redirectOpenNewTab) {
        window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
    } else {
      if (config.redirectOpenNewTab) {
        window.open(url, "_blank");
      } else {
        navigate(url, { replace: true });
      }
    }
  }

  function disconnect() {
    logoutUser();
    const url = (config.redirectAfterLogoutUrl || "").trim();
    if (url) {
      const waitMs = Math.max(0, (config.redirectWaitSeconds || 0) * 1000);
      setTimeout(() => {
        if (/^https?:\/\//i.test(url)) {
          if (config.redirectOpenNewTab) {
            window.open(url, "_blank");
          } else {
            window.location.href = url;
          }
        } else {
          if (config.redirectOpenNewTab) {
            window.open(url, "_blank");
          } else {
            navigate(url, { replace: true });
          }
        }
      }, waitMs);
    } else {
      navigate("/portal/login", { replace: true });
    }
  }

  const accentColor = config.primaryColor || "#10b981";
  const borderRadius = config.borderRadius ?? 16;

  const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    linkedin: Linkedin,
  };

  const progressPercent = (() => {
    const total = Math.max(1, config.redirectWaitSeconds || 1);
    const elapsed = Math.max(0, total - secondsLeft);
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  })();

  function getBackgroundStyle() {
    if (config.backgroundType === "gradient") {
      return `linear-gradient(135deg, ${config.gradientStart} 0%, ${config.gradientEnd} 100%)`;
    } else if (config.backgroundType === "image" && config.backgroundImage) {
      return `url(${config.backgroundImage})`;
    }
    return config.backgroundColor;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 md:p-12" style={{ background: getBackgroundStyle(), backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-md text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div 
            className="w-20 h-20 flex items-center justify-center animate-bounce"
            style={{ backgroundColor: accentColor, borderRadius: `${borderRadius}px` }}
          >
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
        </div>

        {/* Title and Message */}
        <div className="space-y-3">
          <h1 className="text-slate-900">{config.successTitle || "Conectado com Sucesso!"}</h1>
          <p className="text-slate-600">{config.successMessage || "Aproveite sua navegação. Você está conectado à nossa rede WiFi gratuita."}</p>
        </div>

        {/* Timer */}
        {config.successShowTimer && (() => { try { return (localStorage.getItem('portal.targetUrl') || config.redirectAfterLoginUrl || '').trim(); } catch (_) { return (config.redirectAfterLoginUrl || '').trim(); } })() ? (
          <div className="py-4">
            <div className="text-sm text-slate-600">
              Redirecionando em <span className="font-bold" style={{ color: accentColor }}>{secondsLeft}</span> segundos
            </div>
            <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-1000"
                style={{ backgroundColor: accentColor, width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Promo Code */}
        {config.successShowPromo && (
          <div 
            className="p-4 border-2 border-dashed"
            style={{ borderColor: accentColor, borderRadius: `${borderRadius}px`, backgroundColor: `${accentColor}15` }}
          >
            <div className="text-sm text-slate-700 mb-2">{config.successPromoTitle || "Primeira compra com 10% OFF!"}</div>
            <div 
              className="inline-block px-4 py-2 text-white"
              style={{ backgroundColor: accentColor, borderRadius: `${borderRadius / 2}px` }}
            >
              {config.successPromoCode || "WIFI10"}
            </div>
          </div>
        )}

        {/* Social Links */}
        {config.successShowSocial && config.successSocialLinks && Object.values(config.successSocialLinks).some(Boolean) && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Siga-nos nas redes sociais</p>
            <div className="flex justify-center gap-3">
              {Object.entries(config.successSocialLinks).map(([key, url]) => {
                const Icon = socialIcons[key] || null;
                if (!Icon) return null;
                return (
                  <a
                    key={key}
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
                    style={{ borderRadius: `${borderRadius / 2}px` }}
                  >
                    <Icon className="h-5 w-5 text-slate-700" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Elements não persistidos - mantemos espaço para evolução futura */}

        {/* Direct Access Button */}
        <button 
          className="w-full border px-4 py-2"
          style={{ borderRadius: `${borderRadius / 2}px` }}
          onClick={() => {
            if (isPreviewMode) return; // Não redireciona em preview
            performRedirect();
          }}
        >
          Continuar Navegando
        </button>

        {/* Ações secundárias */}
        <div className="mt-6 flex items-center justify-between">
          <Link to="/portal/login" className="underline text-sm">Voltar</Link>
          <button onClick={disconnect} className="text-white rounded-md px-3 py-2 text-sm" style={{ backgroundColor: accentColor }}>Desconectar</button>
        </div>
        <div className="mt-6 text-center">
          <Link to="/admin" className="text-xs text-slate-500 underline">Ir para Admin</Link>
        </div>
      </div>
    </div>
  );
}