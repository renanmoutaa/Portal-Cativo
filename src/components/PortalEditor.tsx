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
import { savePortalLoginConfig, defaultPortalLoginConfig, PortalLoginConfig, loadPortalLoginConfig, syncPortalLoginConfigFromBackend } from "../portal/config";

export function PortalEditor() {
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeEditor, setActiveEditor] = useState<"login" | "success">("login");
  const [currentLoginConfig, setCurrentLoginConfig] = useState<PortalLoginConfig>(loadPortalLoginConfig());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>("idle");

  // Garantir que o editor comece com a última versão do backend
  useEffect(() => {
    (async () => {
      await syncPortalLoginConfigFromBackend();
      setCurrentLoginConfig(loadPortalLoginConfig());
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
    savePortalLoginConfig(currentLoginConfig);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Editor do Portal Cativo</h1>
          <p className="text-slate-600">Crie e personalize suas páginas de forma visual e intuitiva</p>
        </div>
        <div className="flex gap-2 items-center">
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
            <SuccessPageEditor viewMode={viewMode} previewWidth={getPreviewWidth()} config={currentLoginConfig} onConfigChange={setCurrentLoginConfig} />
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
