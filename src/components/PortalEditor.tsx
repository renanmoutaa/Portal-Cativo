import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Save,
  Eye,
  Download,
  Copy,
  Undo,
  Redo,
  Smartphone,
  Monitor,
  Tablet
} from "lucide-react";
import { LoginPageEditor } from "./portal-editor/LoginPageEditor";
import { SuccessPageEditor } from "./portal-editor/SuccessPageEditor";
import { AuthenticationSettings } from "./portal-editor/AuthenticationSettings";
import { AdvancedSettings } from "./portal-editor/AdvancedSettings";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { savePortalLoginConfig, defaultPortalLoginConfig, PortalLoginConfig, loadPortalLoginConfig, syncPortalLoginConfigFromBackend, PortalPostLoginConfig, loadPortalPostLoginConfig, savePortalPostLoginConfig, syncPortalPostLoginConfigFromBackend } from "../portal/config";
import { getApiBases } from "../config/api";

export function PortalEditor() {
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeEditor, setActiveEditor] = useState<"login" | "success">("login");
  const [currentLoginConfig, setCurrentLoginConfig] = useState<PortalLoginConfig>(loadPortalLoginConfig());
  const [currentPostConfig, setCurrentPostConfig] = useState<PortalPostLoginConfig>(loadPortalPostLoginConfig());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>("idle");
  const [controllers, setControllers] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedControllerId, setSelectedControllerId] = useState<number>(() => {
    try { return Number(localStorage.getItem("portal.selectedControllerId") || "0") || 0; } catch (_) { return 0; }
  });

  // Garantir que o editor comece com a última versão do backend
  useEffect(() => {
    (async () => {
      // Carregar lista de controladoras e seleção atual
      try {
        const { NEST_BASE } = await getApiBases();
        const res = await fetch(`${NEST_BASE}/controllers`, { cache: "no-store" });
        const data = await res.json().catch(() => ({} as any));
        const list = Array.isArray(data.controllers) ? data.controllers : [];
        setControllers(list.map((c: any) => ({ id: Number(c.id), name: String(c.name || `Controller ${c.id}`) })));
        // Seleção automática: apenas controladora online
        let desiredId = selectedControllerId;
        const checkOnline = async (id: number) => {
          try {
            const ping = await fetch(`${NEST_BASE}/controllers/${id}/sites`, { cache: "no-store" });
            if (!ping.ok) return false;
            const d = await ping.json().catch(() => ({} as any));
            return !(d && typeof d.error === 'string');
          } catch (_) { return false; }
        };
        // Se não há seleção atual ou está offline, escolher a primeira online
        const currentIsOnline = desiredId ? await checkOnline(desiredId) : false;
        if (!currentIsOnline) {
          let chosen = 0;
          for (const c of list) {
            const id = Number(c?.id) || 0;
            if (!id) continue;
            if (await checkOnline(id)) { chosen = id; break; }
          }
          if (chosen > 0) {
            desiredId = chosen;
          } else if (list.length) {
            desiredId = Number(list[0].id) || 1;
          }
          setSelectedControllerId(desiredId);
          try { localStorage.setItem("portal.selectedControllerId", String(desiredId)); } catch (_) {}
        }
      } catch (_) {}

      await syncPortalLoginConfigFromBackend();
      await syncPortalPostLoginConfigFromBackend();
      setCurrentLoginConfig(loadPortalLoginConfig());
      setCurrentPostConfig(loadPortalPostLoginConfig());
    })();
  }, []);

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    // Debounce para evitar muitos POSTs e mitigar sobrescritas fora de ordem
    saveTimer.current = window.setTimeout(() => {
      savePortalLoginConfig(currentLoginConfig);
    }, 400);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [currentLoginConfig]);

  // Debounce de salvamento para pós-login
  const postSaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (postSaveTimer.current) {
      window.clearTimeout(postSaveTimer.current);
    }
    postSaveTimer.current = window.setTimeout(() => {
      savePortalPostLoginConfig(currentPostConfig);
    }, 400);
    return () => {
      if (postSaveTimer.current) {
        window.clearTimeout(postSaveTimer.current);
      }
    };
  }, [currentPostConfig]);

  const getPreviewWidth = () => {
    switch (viewMode) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      default:
        return "100%";
    }
  };

  function handleSave() {
    if (activeEditor === 'success') {
      savePortalPostLoginConfig(currentPostConfig);
    } else {
      savePortalLoginConfig(currentLoginConfig);
    }
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  async function handleControllerChange(idStr: string) {
    const id = Number(idStr) || 1;
    setSelectedControllerId(id);
    try { localStorage.setItem("portal.selectedControllerId", String(id)); } catch (_) {}
    // Sincroniza do backend para a controladora selecionada
    await syncPortalLoginConfigFromBackend();
    await syncPortalPostLoginConfigFromBackend();
    const loaded = loadPortalLoginConfig();
    const loadedPost = loadPortalPostLoginConfig();
    // Se a controladora ainda não possui configuração (igual ao default),
    // migra automaticamente o design atual para ela.
    try {
      const isLoadedDefault = JSON.stringify(loaded) === JSON.stringify(defaultPortalLoginConfig);
      const isCurrentDefault = JSON.stringify(currentLoginConfig) === JSON.stringify(defaultPortalLoginConfig);
      if (isLoadedDefault && !isCurrentDefault) {
        // Persistir design atual para a nova controladora
        savePortalLoginConfig(currentLoginConfig);
        // Manter a visualização com a configuração atual
        setCurrentLoginConfig(currentLoginConfig);
        return;
      }
    } catch (_) {
      // fallback simples
    }
    setCurrentLoginConfig(loaded);
    setCurrentPostConfig(loadedPost);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Editor do Portal Cativo</h1>
          <p className="text-slate-600">Crie e personalize suas páginas de forma visual e intuitiva</p>
        </div>
      <div className="flex gap-2 items-center">
          {/* Seletor de Controladora */}
          <Select value={selectedControllerId ? String(selectedControllerId) : undefined} onValueChange={handleControllerChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecionar Controladora" />
            </SelectTrigger>
            <SelectContent>
              {controllers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name} (ID {c.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Redo className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="gap-2" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.open('/portal/login', '_blank')}>
            <Eye className="h-4 w-4" />
            Abrir Portal
          </Button>
          {/* Novo: botão para abrir preview da página pós-login */}
          <Button variant="outline" className="gap-2" onClick={() => window.open('/portal/status-preview?preview=1', '_blank')}>
            <Eye className="h-4 w-4" />
            Abrir Pós-Login
          </Button>
          {saveStatus === 'success' && (
            <Badge variant="secondary">Configuração salva</Badge>
          )}
        </div>
      </div>

      {/* Page Selector */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeEditor === "login" ? "default" : "outline"}
                onClick={() => setActiveEditor("login")}
              >
                Página de Login
              </Button>
              <Button
                variant={activeEditor === "success" ? "default" : "outline"}
                onClick={() => setActiveEditor("success")}
              >
                Página Pós-Login
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Visualização:</span>
                <div className="flex gap-1 border border-slate-200 rounded-lg p-1">
                  <Button
                    variant={viewMode === "desktop" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("desktop")}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "tablet" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("tablet")}
                  >
                    <Tablet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "mobile" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor Content */}
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="inline-flex w-fit gap-2">
          <TabsTrigger value="design">Visual e Autenticação</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
        </TabsList>
      
        <TabsContent value="design" className="mt-6 space-y-6">
          {activeEditor === "login" ? (
            <LoginPageEditor viewMode={viewMode} previewWidth={getPreviewWidth()} config={currentLoginConfig} onConfigChange={setCurrentLoginConfig} />
          ) : (
            <SuccessPageEditor viewMode={viewMode} previewWidth={getPreviewWidth()} config={currentPostConfig} onConfigChange={setCurrentPostConfig} />
          )}
      
          {/* Mover Autenticação para esta aba */}
          <AuthenticationSettings config={currentLoginConfig} onConfigChange={setCurrentLoginConfig} />
        </TabsContent>
      
        {/* Removido conteúdo da aba 'auth' para consolidar em 'design' */}
        <TabsContent value="advanced" className="mt-6">
          <AdvancedSettings config={currentLoginConfig} onConfigChange={setCurrentLoginConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
