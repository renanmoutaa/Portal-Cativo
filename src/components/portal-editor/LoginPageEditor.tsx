import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { 
  Upload,
  Palette,
  Type,
  Sparkles,
  Wifi,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  CreditCard,
  FileText
} from "lucide-react";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Badge } from "../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { PortalLoginConfig } from "../../portal/config";

const templates = [
  { id: "modern", name: "Moderno", bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", primary: "#667eea" },
  { id: "minimal", name: "Minimalista", bg: "#ffffff", primary: "#000000" },
  { id: "dark", name: "Dark Mode", bg: "#1a1a1a", primary: "#3b82f6" },
  { id: "gradient", name: "Gradiente", bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", primary: "#f5576c" },
  { id: "ocean", name: "Oceano", bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", primary: "#4facfe" },
  { id: "sunset", name: "Pôr do Sol", bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", primary: "#fa709a" }
];

const fonts = [
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "poppins", label: "Poppins" },
  { value: "montserrat", label: "Montserrat" },
  { value: "playfair", label: "Playfair Display" },
];

const elementTypes = [
  { id: "logo", name: "Logo", icon: ImageIcon },
  { id: "title", name: "Título", icon: Type },
  { id: "subtitle", name: "Subtítulo", icon: Type },
  { id: "buttons", name: "Botões de Login", icon: Palette },
  { id: "footer", name: "Rodapé", icon: Type },
];

interface LoginPageEditorProps {
  viewMode: "desktop" | "tablet" | "mobile";
  previewWidth: string;
  config: PortalLoginConfig;
  onConfigChange?: (cfg: PortalLoginConfig) => void;
}

export function LoginPageEditor({ viewMode, previewWidth, config, onConfigChange }: LoginPageEditorProps) {
  const syncingRef = useRef(false);
  const [backgroundColor, setBackgroundColor] = useState(config.backgroundColor || "#1e293b");
  const [backgroundType, setBackgroundType] = useState<"solid" | "gradient" | "image">(config.backgroundType || "gradient");
  const [gradientStart, setGradientStart] = useState(config.gradientStart || "#667eea");
  const [gradientEnd, setGradientEnd] = useState(config.gradientEnd || "#764ba2");
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor || "#667eea");
  const [logoUrl, setLogoUrl] = useState(config.logoUrl || "");
  const [logoSize, setLogoSize] = useState(config.logoSize ?? 80);
  const [backgroundImage, setBackgroundImage] = useState(config.backgroundImage || "");
  const [borderRadius, setBorderRadius] = useState([config.borderRadius ?? 16]);
  const [opacity, setOpacity] = useState([config.opacity ?? 95]);
  const [font, setFont] = useState(config.font || "inter");
  const [title, setTitle] = useState(config.title || "Conecte-se ao WiFi Grátis");
  const [subtitle, setSubtitle] = useState(config.subtitle || "Faça login para continuar navegando");
  const [showLogo, setShowLogo] = useState(config.showLogo ?? true);
  const [showTitle, setShowTitle] = useState(config.showTitle ?? true);
  const [showSubtitle, setShowSubtitle] = useState(config.showSubtitle ?? true);
// Estado controlado dos acordeões (iniciam recolhidos)
const [leftAccordion, setLeftAccordion] = useState<string[]>(() => {
  try {
    const raw = localStorage.getItem("loginEditor:leftAccordion:v2");
    if (raw) return JSON.parse(raw);
    return ["templates", "design-controls"];
  } catch {
    return ["templates", "design-controls"];
  }
});

const [designAccordion, setDesignAccordion] = useState<string | undefined>(() => {
  const v = localStorage.getItem("loginEditor:designAccordion");
  return v || undefined;
});

useEffect(() => {
  localStorage.setItem("loginEditor:leftAccordion:v2", JSON.stringify(leftAccordion));
}, [leftAccordion]);

useEffect(() => {
  if (designAccordion) {
    localStorage.setItem("loginEditor:designAccordion", designAccordion);
  } else {
    localStorage.removeItem("loginEditor:designAccordion");
  }
}, [designAccordion]);
  const [cardShadow, setCardShadow] = useState(config.cardShadow ?? true);
  const [blurEffect, setBlurEffect] = useState(config.blurEffect ?? false);

  // Sincronizar preview com mudanças externas no config
  useEffect(() => {
    syncingRef.current = true;
    setBackgroundType(config.backgroundType || "gradient");
    setBackgroundColor(config.backgroundColor || "#1e293b");
    setGradientStart(config.gradientStart || "#667eea");
    setGradientEnd(config.gradientEnd || "#764ba2");
    setBackgroundImage(config.backgroundImage || "");
    setBlurEffect(config.blurEffect ?? false);
    setPrimaryColor(config.primaryColor || "#667eea");
    setBorderRadius([config.borderRadius ?? 16]);
    setOpacity([config.opacity ?? 95]);
    setFont(config.font || "inter");
    setShowLogo(config.showLogo ?? true);
    setLogoUrl(config.logoUrl || "");
    setLogoSize(config.logoSize ?? 80);
    setShowTitle(config.showTitle ?? true);
    setTitle(config.title || "Conecte-se ao WiFi Grátis");
    setShowSubtitle(config.showSubtitle ?? true);
    setSubtitle(config.subtitle || "Faça login para continuar navegando");
    setCardShadow(config.cardShadow ?? true);
    // liberar propagação após aplicar sync externo
    setTimeout(() => { syncingRef.current = false; }, 0);
  }, [config]);

  // Upload de imagens (fundo e logo)
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  function handleBackgroundFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBackgroundImage(dataUrl);
      setBackgroundType("image");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  
  function handleLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  // Propagar configuração atual para o Editor pai
  useEffect(() => {
    if (syncingRef.current) return; // evita loop quando sincronizando do config externo
    const cfg: PortalLoginConfig = {
      ...config,
      backgroundType,
      backgroundColor,
      gradientStart,
      gradientEnd,
      backgroundImage,
      blurEffect,
      primaryColor,
      borderRadius: borderRadius?.[0] ?? 16,
      opacity: opacity?.[0] ?? 95,
      font,
      showLogo,
      logoUrl,
      logoSize,
      showTitle,
      title,
      showSubtitle,
      subtitle,
      cardShadow,
    };
    onConfigChange?.(cfg);
  }, [
    backgroundType,
    backgroundColor,
    gradientStart,
    gradientEnd,
    backgroundImage,
    blurEffect,
    primaryColor,
    borderRadius,
    opacity,
    font,
    showLogo,
    logoUrl,
    logoSize,
    showTitle,
    title,
    showSubtitle,
    subtitle,
    cardShadow,
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

  const applyTemplate = (template: typeof templates[0]) => {
    if (template.bg.startsWith("linear-gradient")) {
      setBackgroundType("gradient");
      const colors = template.bg.match(/#[0-9a-f]{6}/gi) || [];
      if (colors.length >= 2) {
        setGradientStart(colors[0]);
        setGradientEnd(colors[1]);
      }
    } else {
      setBackgroundType("solid");
      setBackgroundColor(template.bg);
    }
    setPrimaryColor(template.primary);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Panel - Design Controls */}
      <div className="lg:col-span-1 space-y-6">
        {/* Quick Templates + Design Controls (Accordion) */}
        <Accordion type="multiple" className="w-full space-y-2" value={leftAccordion} onValueChange={(v) => setLeftAccordion(Array.isArray(v) ? v : [])}>
          <AccordionItem value="templates">
            <AccordionTrigger className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Templates Rápidos
            </AccordionTrigger>
            <AccordionContent>
              <Card className="border-slate-200">
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="group relative"
                      >
                        <div 
                          className="aspect-square rounded-lg border-2 border-slate-200 overflow-hidden hover:border-blue-500 transition-all hover:scale-105"
                          style={{ background: template.bg }}
                        >
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <div className="text-xs text-slate-600 text-center mt-1">{template.name}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="design-controls">
            <AccordionTrigger className="text-sm">Controles de Design</AccordionTrigger>
            <AccordionContent>
              <Card className="border-slate-200">
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" value={designAccordion} onValueChange={setDesignAccordion}>
                    <AccordionItem value="background">
                      <AccordionTrigger className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Fundo</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={backgroundType === "solid" ? "default" : "outline"}
                            onClick={() => setBackgroundType("solid")}
                            size="sm"
                          >
                            Sólido
                          </Button>
                          <Button
                            variant={backgroundType === "gradient" ? "default" : "outline"}
                            onClick={() => setBackgroundType("gradient")}
                            size="sm"
                          >
                            Gradiente
                          </Button>
                          <Button
                            variant={backgroundType === "image" ? "default" : "outline"}
                            onClick={() => setBackgroundType("image")}
                            size="sm"
                          >
                            Imagem
                          </Button>
                        </div>

                        {backgroundType === "solid" && (
                          <div className="space-y-2">
                            <Label className="text-xs">Cor de Fundo</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="w-12 h-10 p-1"
                              />
                              <Input 
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                placeholder="#000000"
                                className="text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {backgroundType === "gradient" && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs">Cor Inicial</Label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={gradientStart}
                                  onChange={(e) => setGradientStart(e.target.value)}
                                  className="w-12 h-10 p-1"
                                />
                                <Input 
                                  value={gradientStart}
                                  onChange={(e) => setGradientStart(e.target.value)}
                                  className="text-xs"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Cor Final</Label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={gradientEnd}
                                  onChange={(e) => setGradientEnd(e.target.value)}
                                  className="w-12 h-10 p-1"
                                />
                                <Input 
                                  value={gradientEnd}
                                  onChange={(e) => setGradientEnd(e.target.value)}
                                  className="text-xs"
                                />
                              </div>
                            </div>
                            <div 
                              className="h-12 rounded-lg border border-slate-200"
                              style={{ background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)` }}
                            />
                          </>
                        )}

                        {backgroundType === "image" && (
                          <div className="space-y-2">
                            <Label className="text-xs">URL da Imagem</Label>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="https://..."
                                value={backgroundImage}
                                onChange={(e) => setBackgroundImage(e.target.value)}
                                className="text-xs"
                              />
                              <input
                                ref={bgFileInputRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleBackgroundFileSelected}
                              />
                              <Button variant="outline" size="icon" type="button" onClick={() => bgFileInputRef.current?.click()}>
                                <Upload className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <Label className="text-xs">Efeito Blur</Label>
                          <Switch checked={blurEffect} onCheckedChange={setBlurEffect} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="colors">
                      <AccordionTrigger className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Cores e Tipografia</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Cor Primária</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-12 h-10 p-1"
                            />
                            <Input 
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Fonte</Label>
                          <Select value={font} onValueChange={setFont}>
                            <SelectTrigger className="text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fonts.map((f) => (
                                <SelectItem key={f.value} value={f.value} className="text-xs">
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="card">
                      <AccordionTrigger className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Card de Login</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs">Bordas Arredondadas</Label>
                            <span className="text-xs text-slate-600">{borderRadius}px</span>
                          </div>
                          <Slider 
                            value={borderRadius} 
                            onValueChange={setBorderRadius}
                            max={40}
                            step={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs">Opacidade</Label>
                            <span className="text-xs text-slate-600">{opacity}%</span>
                          </div>
                          <Slider 
                            value={opacity} 
                            onValueChange={setOpacity}
                            max={100}
                            step={5}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Sombra</Label>
                          <Switch checked={cardShadow} onCheckedChange={setCardShadow} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="content">
                      <AccordionTrigger className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Conteúdo</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Exibir Logo</Label>
                            <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                          </div>

                          {showLogo && (
                            <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                              <Label className="text-xs">URL da Logo</Label>
                              <div className="flex gap-2">
                                <Input 
                                  placeholder="https://..."
                                  value={logoUrl}
                                  onChange={(e) => setLogoUrl(e.target.value)}
                                  className="text-xs"
                                />
                                <input
                                  ref={logoFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={handleLogoFileSelected}
                                />
                                <Button variant="outline" size="icon" type="button" onClick={() => logoFileInputRef.current?.click()}>
                                  <Upload className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="space-y-1 mt-2">
                                <Label className="text-xs">Tamanho</Label>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <Slider
                                      min={40}
                                      max={240}
                                      value={[logoSize]}
                                      onValueChange={(v) => setLogoSize(v[0])}
                                      className="[&_[data-slot=slider-track]]:bg-slate-200 [&_[data-slot=slider-range]]:bg-[#0b0b1a] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border [&_[data-slot=slider-thumb]]:border-slate-300"
                                    />
                                  </div>
                                  <span className="text-xs w-12 text-right">{Math.round(logoSize)} px</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <Separator />

                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Exibir Título</Label>
                            <Switch checked={showTitle} onCheckedChange={setShowTitle} />
                          </div>

                          {showTitle && (
                            <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                              <Label className="text-xs">Texto do Título</Label>
                              <Input 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-xs"
                              />
                            </div>
                          )}

                          <Separator />

                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Exibir Subtítulo</Label>
                            <Switch checked={showSubtitle} onCheckedChange={setShowSubtitle} />
                          </div>

                          {showSubtitle && (
                            <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                              <Label className="text-xs">Texto do Subtítulo</Label>
                              <Textarea 
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                className="text-xs"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
                className="rounded-xl overflow-hidden border-4 border-slate-300 shadow-2xl"
                style={{ 
                  background: getBackgroundStyle(),
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  minHeight: "600px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                  backdropFilter: blurEffect ? "blur(10px)" : "none"
                }}
              >
                <div 
                  className="bg-white w-full max-w-md transition-all duration-300"
                  style={{ 
                    borderRadius: `${borderRadius}px`,
                    opacity: opacity[0] / 100,
                    padding: "2.5rem",
                    boxShadow: cardShadow ? "0 25px 50px -12px rgba(0, 0, 0, 0.25)" : "none"
                  }}
                >
                  {showLogo && (
                    <div className="mb-6 text-center">
                      {logoUrl ? (
                        <div className="mb-6 flex justify-center">
                          <div className="relative inline-block" style={{ width: `${logoSize}px` }}>
                            <img
                              src={logoUrl}
                              alt="Logo"
                              style={{
                                width: "100%",
                                height: "auto",
                                borderRadius: `${borderRadius / 1.5}px`,
                                objectFit: "contain",
                                display: "block",
                                backgroundColor: "transparent"
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="w-20 h-20 mx-auto flex items-center justify-center"
                          style={{ 
                            backgroundColor: primaryColor,
                            borderRadius: `${borderRadius / 1.5}px`
                          }}
                        >
                          <Wifi className="h-10 w-10 text-white" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {showTitle && (
                    <h2 
                      className="text-slate-900 text-center mb-2"
                      style={{ fontFamily: font }}
                    >
                      {title}
                    </h2>
                  )}

                  {showSubtitle && (
                    <p 
                      className="text-sm text-slate-600 text-center mb-8"
                      style={{ fontFamily: font }}
                    >
                      {subtitle}
                    </p>
                  )}
                  
                  <div className="space-y-3">
                    {config.enableFacebook && (
                      <Button 
                        className="w-full transition-all hover:scale-105"
                        style={{ 
                          backgroundColor: primaryColor,
                          borderRadius: `${(Array.isArray(borderRadius) ? borderRadius[0] : borderRadius) / 2}px`
                        }}
                      >
                        Continuar com Facebook
                      </Button>
                    )}
                    {config.enableGoogle && (
                      <Button 
                        className="w-full transition-all hover:scale-105"
                        variant="outline"
                        style={{ 
                          borderRadius: `${(Array.isArray(borderRadius) ? borderRadius[0] : borderRadius) / 2}px`
                        }}
                      >
                        Continuar com Google
                      </Button>
                    )}
                    {config.enableEmail && (
                      <Button 
                        className="w-full transition-all hover:scale-105"
                        variant="outline"
                        style={{ 
                          borderRadius: `${(Array.isArray(borderRadius) ? borderRadius[0] : borderRadius) / 2}px`
                        }}
                      >
                        Continuar com Email
                      </Button>
                    )}
                  </div>

                  <p 
                    className="text-xs text-slate-500 text-center mt-6"
                    style={{ fontFamily: font }}
                  >
                    Ao continuar, você concorda com nossos <span className="underline cursor-pointer">Termos de Uso</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
