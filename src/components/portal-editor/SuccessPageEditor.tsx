import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { 
  Upload,
  Eye,
  CheckCircle,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Plus,
  Trash2,
  GripVertical
} from "lucide-react";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
// Removed unused Select imports to satisfy lint rules
import { Slider } from "../ui/slider";
import { PortalPostLoginConfig } from "../../portal/config";
import { getApiBases } from "../../config/api";

interface SuccessPageEditorProps {
  viewMode: "desktop" | "tablet" | "mobile";
  previewWidth: string;
  config: PortalPostLoginConfig;
  onConfigChange?: (cfg: PortalPostLoginConfig) => void;
}

const socialIcons = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin
};

export function SuccessPageEditor({ viewMode, previewWidth, config, onConfigChange }: SuccessPageEditorProps) {
  // Visual independente (espelha editor de Login)
  const [backgroundColor, setBackgroundColor] = useState(config.backgroundColor || "#1e293b");
  const [backgroundType, setBackgroundType] = useState<"solid" | "gradient" | "image">(config.backgroundType || "gradient");
  const [gradientStart, setGradientStart] = useState(config.gradientStart || "#667eea");
  const [gradientEnd, setGradientEnd] = useState(config.gradientEnd || "#764ba2");
  const [backgroundImage, setBackgroundImage] = useState(config.backgroundImage || "");
  const [accentColor, setAccentColor] = useState(config.primaryColor || "#10b981");
  const [borderRadius, setBorderRadius] = useState([config.borderRadius ?? 16]);
  const [opacity, setOpacity] = useState([config.opacity ?? 95]);
  const [font, setFont] = useState(config.font || "inter");
  const [showLogo, setShowLogo] = useState(config.showLogo ?? true);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl || "");
  const [logoSize, setLogoSize] = useState(config.logoSize ?? 80);
  const [cardShadow, setCardShadow] = useState(config.cardShadow ?? true);

  // Conteúdo pós-login
  const [title, setTitle] = useState(config.successTitle || "Conectado com Sucesso!");
  const [message, setMessage] = useState(config.successMessage || "Aproveite sua navegação. Você está conectado à nossa rede WiFi gratuita.");
  const [showTimer, setShowTimer] = useState(config.successShowTimer ?? true);
  const [redirectTime, setRedirectTime] = useState(config.redirectWaitSeconds ?? 5);
  const [redirectUrl, setRedirectUrl] = useState(config.redirectAfterLoginUrl || "");
  const [showSocialLinks, setShowSocialLinks] = useState(config.successShowSocial ?? true);
  const [showPromo, setShowPromo] = useState(config.successShowPromo ?? true);
  const [promoTitle, setPromoTitle] = useState(config.successPromoTitle || "Primeira compra com 10% OFF!");
  const [promoCode, setPromoCode] = useState(config.successPromoCode || "WIFI10");
  const [socialLinks, setSocialLinks] = useState<PortalPostLoginConfig["successSocialLinks"]>(config.successSocialLinks || {});

  // Personalizados
  const [customElements, setCustomElements] = useState<Array<{ id: number; type: "text" | "button"; content: string; url?: string; enabled: boolean }>>([]);

  // Uploads
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleBackgroundFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const controllerId = (() => {
        try { return Number(localStorage.getItem("portal.selectedControllerId") || "1") || 1; } catch { return 1; }
      })();
      const { NEST_BASE } = await getApiBases();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${NEST_BASE}/controllers/${controllerId}/upload-image`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({} as any));
      if (data?.url) {
        setBackgroundImage(String(data.url));
        setBackgroundType("image");
      }
    } catch (err) {
      console.warn('Falha no upload de imagem de fundo:', err);
    } finally {
      e.target.value = "";
    }
  }

  async function handleLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const controllerId = (() => {
        try { return Number(localStorage.getItem("portal.selectedControllerId") || "1") || 1; } catch { return 1; }
      })();
      const { NEST_BASE } = await getApiBases();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${NEST_BASE}/controllers/${controllerId}/upload-image`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({} as any));
      if (data?.url) {
        setLogoUrl(String(data.url));
      }
    } catch (err) {
      console.warn('Falha no upload da logo:', err);
    } finally {
      e.target.value = "";
    }
  }

  // Sincroniza estados quando config externo mudar
  useEffect(() => {
    setBackgroundType(config.backgroundType || "gradient");
    setBackgroundColor(config.backgroundColor || "#1e293b");
    setGradientStart(config.gradientStart || "#667eea");
    setGradientEnd(config.gradientEnd || "#764ba2");
    setBackgroundImage(config.backgroundImage || "");
    setAccentColor(config.primaryColor || "#10b981");
    setBorderRadius([config.borderRadius ?? 16]);
    setOpacity([config.opacity ?? 95]);
    setFont(config.font || "inter");
    setShowLogo(config.showLogo ?? true);
    setLogoUrl(config.logoUrl || "");
    setLogoSize(config.logoSize ?? 80);
    setCardShadow(config.cardShadow ?? true);

    setTitle(config.successTitle || "Conectado com Sucesso!");
    setMessage(config.successMessage || "Aproveite sua navegação. Você está conectado à nossa rede WiFi gratuita.");
    setShowTimer(config.successShowTimer ?? true);
    setRedirectTime(config.redirectWaitSeconds ?? 5);
    setRedirectUrl(config.redirectAfterLoginUrl || "");
    setShowSocialLinks(config.successShowSocial ?? true);
    setShowPromo(config.successShowPromo ?? true);
    setPromoTitle(config.successPromoTitle || "Primeira compra com 10% OFF!");
    setPromoCode(config.successPromoCode || "WIFI10");
    setSocialLinks(config.successSocialLinks || {});
  }, [config]);

  // Propaga alterações para o Editor pai
  useEffect(() => {
    const cfg: PortalPostLoginConfig = {
      ...config,
      backgroundType,
      backgroundColor,
      gradientStart,
      gradientEnd,
      backgroundImage,
      primaryColor: accentColor,
      borderRadius: borderRadius?.[0] ?? 16,
      opacity: opacity?.[0] ?? 95,
      font,
      showLogo,
      logoUrl,
      logoSize,
      cardShadow,
      successTitle: title,
      successMessage: message,
      successShowTimer: showTimer,
      redirectWaitSeconds: redirectTime,
      redirectAfterLoginUrl: redirectUrl,
      successShowSocial: showSocialLinks,
      successShowPromo: showPromo,
      successPromoTitle: promoTitle,
      successPromoCode: promoCode,
      successSocialLinks: socialLinks,
    };
    onConfigChange?.(cfg);
  }, [
    backgroundType,
    backgroundColor,
    gradientStart,
    gradientEnd,
    backgroundImage,
    accentColor,
    borderRadius,
    opacity,
    font,
    showLogo,
    logoUrl,
    logoSize,
    cardShadow,
    title,
    message,
    showTimer,
    redirectTime,
    redirectUrl,
    showSocialLinks,
    showPromo,
    promoTitle,
    promoCode,
    socialLinks,
    onConfigChange,
  ]);

  const getBackgroundStyle = () => {
    if (backgroundType === "gradient") {
      return `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;
    } else if (backgroundType === "image" && backgroundImage) {
      return `url(${backgroundImage})`;
    }
    return backgroundColor;
  };

  const addElement = (type: "text" | "button") => {
    const newElement = {
      id: Date.now(),
      type,
      content: type === "text" ? "Novo texto" : "Novo botão",
      url: type === "button" ? "https://" : undefined,
      enabled: true
    };
    setCustomElements([...customElements, newElement]);
  };

  const removeElement = (id: number) => {
    setCustomElements(customElements.filter(el => el.id !== id));
  };

  const updateElement = (id: number, field: string, value: any) => {
    setCustomElements(customElements.map(el => 
      el.id === id ? { ...el, [field]: value } : el
    ));
  };

  // Derived values to avoid using arrays directly in styles/labels
  const borderRadiusValue = (borderRadius?.[0] ?? 16);
  const opacityValue = (opacity?.[0] ?? 95);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Panel - Design Controls */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 text-sm">Controles da Página de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="style">
            <AccordionTrigger className="text-sm">Estilo Visual</AccordionTrigger>
            <AccordionContent className="space-y-4">
                  {/* Fundo */}
                  <div className="space-y-2">
                    <Label className="text-xs">Fundo</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant={backgroundType === "solid" ? "default" : "outline"} size="sm" onClick={() => setBackgroundType("solid")}>Sólido</Button>
                      <Button variant={backgroundType === "gradient" ? "default" : "outline"} size="sm" onClick={() => setBackgroundType("gradient")}>Gradiente</Button>
                      <Button variant={backgroundType === "image" ? "default" : "outline"} size="sm" onClick={() => setBackgroundType("image")}>Imagem</Button>
                    </div>
                  </div>

                  {backgroundType === "solid" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Cor de Fundo</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-12 h-10 p-1" />
                        <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="text-xs" />
                      </div>
                    </div>
                  )}

                  {backgroundType === "gradient" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Cor Inicial</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="w-12 h-10 p-1" />
                          <Input value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Cor Final</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="w-12 h-10 p-1" />
                          <Input value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                      <div className="h-12 rounded-lg border border-slate-200" style={{ background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)` }} />
                    </>
                  )}

                  {backgroundType === "image" && (
                    <div className="space-y-2">
                      <Label className="text-xs">URL da Imagem</Label>
                      <div className="flex gap-2">
                        <Input placeholder="https://..." value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} className="text-xs" />
                        <input ref={bgFileInputRef} type="file" accept="image/*" hidden onChange={handleBackgroundFileSelected} />
                        <Button variant="outline" size="icon" type="button" onClick={() => bgFileInputRef.current?.click()}>
                          <Upload className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs">Cor de Destaque</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-12 h-10 p-1" />
                      <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="text-xs" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Arredondamento</Label>
                      <span className="text-xs text-slate-600">{borderRadiusValue}px</span>
                    </div>
                    <Slider value={borderRadius} onValueChange={setBorderRadius} max={40} step={2} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Opacidade</Label>
                      <span className="text-xs text-slate-600">{opacityValue}%</span>
                    </div>
                    <Slider value={opacity} onValueChange={setOpacity} max={100} step={5} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Sombra</Label>
                    <Switch checked={cardShadow} onCheckedChange={setCardShadow} />
                  </div>
            </AccordionContent>
          </AccordionItem>

              <AccordionItem value="content">
                <AccordionTrigger className="text-sm">Conteúdo Principal</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Exibir Logo</Label>
                    <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                  </div>

                  {showLogo && (
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      <Label className="text-xs">URL da Logo</Label>
                      <div className="flex gap-2">
                        <Input placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="text-xs" />
                        <input ref={logoFileInputRef} type="file" accept="image/*" hidden onChange={handleLogoFileSelected} />
                        <Button variant="outline" size="icon" type="button" onClick={() => logoFileInputRef.current?.click()}>
                          <Upload className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1 mt-2">
                        <Label className="text-xs">Tamanho</Label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Slider min={40} max={240} value={[logoSize]} onValueChange={(v) => setLogoSize(v[0])} className="[&_[data-slot=slider-track]]:bg-slate-200 [&_[data-slot=slider-range]]:bg-[#0b0b1a] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border [&_[data-slot=slider-thumb]]:border-slate-300" />
                          </div>
                          <span className="text-xs w-12 text-right">{Math.round(logoSize)} px</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="text-xs" rows={3} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="redirect">
                <AccordionTrigger className="text-sm">Redirecionamento</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mostrar Timer</Label>
                    <Switch checked={showTimer} onCheckedChange={setShowTimer} />
                  </div>
                  {showTimer && (
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      <Label className="text-xs">Tempo de Redirecionamento (segundos)</Label>
                      <Input type="number" value={redirectTime} onChange={(e) => setRedirectTime(Number(e.target.value))} className="text-xs" min="3" max="30" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">URL de Redirecionamento</Label>
                    <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="text-xs" placeholder="https://" />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="social">
                <AccordionTrigger className="text-sm">Redes Sociais</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Exibir Redes Sociais</Label>
                    <Switch checked={showSocialLinks} onCheckedChange={setShowSocialLinks} />
                  </div>

                  {showSocialLinks && (
                    <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                      <div className="space-y-2">
                        <Label className="text-xs">Facebook</Label>
                        <Input placeholder="https://facebook.com/..." className="text-xs" value={socialLinks.facebook || ""} onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Instagram</Label>
                        <Input placeholder="https://instagram.com/..." className="text-xs" value={socialLinks.instagram || ""} onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Twitter</Label>
                        <Input placeholder="https://twitter.com/..." className="text-xs" value={socialLinks.twitter || ""} onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="promo">
                <AccordionTrigger className="text-sm">Promoções</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Exibir Promoção</Label>
                    <Switch checked={showPromo} onCheckedChange={setShowPromo} />
                  </div>

                  {showPromo && (
                    <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                      <div className="space-y-2">
                        <Label className="text-xs">Título da Promoção</Label>
                        <Input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Código Promocional</Label>
                        <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="text-xs" />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="custom">
                <AccordionTrigger className="text-sm">Elementos Personalizados</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs"
                      onClick={() => addElement("text")}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Texto
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs"
                      onClick={() => addElement("button")}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Botão
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {customElements.map((element) => (
                      <div key={element.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                        <GripVertical className="h-4 w-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <Input 
                            value={element.content}
                            onChange={(e) => updateElement(element.id, "content", e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeElement(element.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="lg:col-span-2">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview em Tempo Real
              </CardTitle>
              <Badge variant="secondary">{viewMode}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 bg-slate-50">
            <div className="mx-auto transition-all duration-300" style={{ maxWidth: previewWidth }}>
              <div 
                className="rounded-xl overflow-hidden border-4 border-slate-300 shadow-2xl p-8 md:p-12"
                style={{ 
                  background: getBackgroundStyle(),
                  backgroundSize: backgroundType === 'image' ? 'cover' : undefined,
                  backgroundPosition: backgroundType === 'image' ? 'center' : undefined,
                  minHeight: "600px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <div className="w-full max-w-md">
                  <div className="w-full p-6 border text-center space-y-6" style={{ borderRadius: `${borderRadiusValue}px`, backgroundColor: `rgba(255,255,255,${opacityValue/100})`, boxShadow: cardShadow ? '0 8px 28px rgba(0,0,0,0.12)' : undefined }}>
                  {showLogo && logoUrl && (
                    <div className="w-full flex items-center justify-center mb-2">
                      <img src={logoUrl} alt="Logo" style={{ height: `${logoSize}px`, width: 'auto' }} />
                    </div>
                  )}
                  {/* Success Icon */}
                  <div className="flex justify-center mb-6">
                    <div 
                      className="w-20 h-20 flex items-center justify-center animate-bounce"
                      style={{ 
                        backgroundColor: accentColor,
                        borderRadius: `${borderRadiusValue}px`
                      }}
                    >
                      <CheckCircle className="h-12 w-12 text-white" />
                    </div>
                  </div>

                  {/* Title and Message */}
                  <div className="space-y-3">
                    <h1 className="text-slate-900">{title}</h1>
                    <p className="text-slate-600">{message}</p>
                  </div>

                  {/* Timer */}
                  {showTimer && (
                    <div className="py-4">
                      <div className="text-sm text-slate-600">
                        Redirecionando em <span className="font-bold" style={{ color: accentColor }}>{redirectTime}</span> segundos
                      </div>
                      <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000"
                          style={{ 
                            backgroundColor: accentColor,
                            width: "60%"
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Promo Code */}
                  {showPromo && (
                    <div 
                      className="p-4 border-2 border-dashed"
                      style={{ 
                        borderColor: accentColor,
                        borderRadius: `${borderRadius}px`,
                        backgroundColor: `${accentColor}15`
                      }}
                    >
                      <div className="text-sm text-slate-700 mb-2">{promoTitle}</div>
                      <div 
                        className="inline-block px-4 py-2 text-white"
                        style={{ 
                          backgroundColor: accentColor,
                        borderRadius: `${borderRadiusValue / 2}px`
                        }}
                      >
                        {promoCode}
                      </div>
                    </div>
                  )}

                  {/* Social Links */}
                  {showSocialLinks && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">Siga-nos nas redes sociais</p>
                      <div className="flex justify-center gap-3">
                        {Object.entries(socialIcons).map(([key, Icon]) => (
                          <button
                            key={key}
                            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
                            style={{ borderRadius: `${borderRadiusValue / 2}px` }}
                          >
                            <Icon className="h-5 w-5 text-slate-700" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Elements */}
                  {customElements.filter(el => el.enabled).map((element) => (
                    <div key={element.id}>
                      {element.type === "text" ? (
                        <p className="text-slate-600">{element.content}</p>
                      ) : (
                        <Button 
                          className="text-xs"
                          onClick={() => {
                            if (element.url) {
                              window.open(element.url, "_blank");
                            }
                          }}
                        >
                          {element.content}
                        </Button>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
