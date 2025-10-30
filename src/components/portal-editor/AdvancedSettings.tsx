import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Code, Zap, Shield, Clock } from "lucide-react";
import { PortalLoginConfig, defaultPortalLoginConfig, savePortalLoginConfig } from "../../portal/config";

export function AdvancedSettings({ config, onConfigChange }: { config: PortalLoginConfig; onConfigChange: (cfg: PortalLoginConfig) => void }) {
  function exportConfig() {
    try {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portal-config.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Falha ao exportar config:", err);
    }
  }
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Configurações de Sessão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tempo de Sessão (minutos)</Label>
              <Input type="number" value={config.sessionMinutes} onChange={(e) => onConfigChange({ ...config, sessionMinutes: Number(e.target.value || 0) })} />
              <p className="text-xs text-slate-500">Tempo máximo que o usuário fica conectado</p>
            </div>

            <div className="space-y-2">
              <Label>Limite de Banda (MB/s)</Label>
              <Input type="number" value={config.bandwidthLimitMbps} onChange={(e) => onConfigChange({ ...config, bandwidthLimitMbps: Number(e.target.value || 0) })} />
              <p className="text-xs text-slate-500">Velocidade máxima por usuário</p>
            </div>

            <div className="space-y-2">
              <Label>Limite de Download (GB)</Label>
              <Input type="number" value={config.downloadLimitGb} onChange={(e) => onConfigChange({ ...config, downloadLimitGb: Number(e.target.value || 0) })} />
              <p className="text-xs text-slate-500">Limite total de download por sessão</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Reconexão Automática</Label>
                <div className="text-sm text-slate-600">
                  Permitir reconexão sem novo login
                </div>
              </div>
              <Switch checked={config.autoReconnect} onCheckedChange={(v) => onConfigChange({ ...config, autoReconnect: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Múltiplos Dispositivos</Label>
                <div className="text-sm text-slate-600">
                  Permitir login simultâneo
                </div>
              </div>
              <Switch checked={config.allowMultiDevice} onCheckedChange={(v) => onConfigChange({ ...config, allowMultiDevice: v })} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacidade e Termos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Aceite de Termos Obrigatório</Label>
                <div className="text-sm text-slate-600">
                  Usuário deve aceitar para conectar
                </div>
              </div>
              <Switch checked={config.requireTermsAccept} onCheckedChange={(v) => onConfigChange({ ...config, requireTermsAccept: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Opt-in para Marketing</Label>
                <div className="text-sm text-slate-600">
                  Checkbox para receber emails
                </div>
              </div>
              <Switch checked={config.allowMarketingOptIn} onCheckedChange={(v) => onConfigChange({ ...config, allowMarketingOptIn: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Analytics e Cookies</Label>
                <div className="text-sm text-slate-600">
                  Coleta de dados anônimos
                </div>
              </div>
              <Switch checked={config.analyticsEnabled} onCheckedChange={(v) => onConfigChange({ ...config, analyticsEnabled: v })} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>URL dos Termos de Uso</Label>
              <Input placeholder="https://empresa.com/termos" value={config.termsUrl} onChange={(e) => onConfigChange({ ...config, termsUrl: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>URL da Política de Privacidade</Label>
              <Input placeholder="https://empresa.com/privacidade" value={config.privacyUrl} onChange={(e) => onConfigChange({ ...config, privacyUrl: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL (Novo Login)</Label>
              <Input placeholder="https://api.empresa.com/webhook" value={config.webhookUrl} onChange={(e) => onConfigChange({ ...config, webhookUrl: e.target.value })} />
              <p className="text-xs text-slate-500">Recebe notificação quando novo usuário se conecta</p>
            </div>

            <div className="space-y-2">
              <Label>Google Analytics ID</Label>
              <Input placeholder="G-XXXXXXXXXX" value={config.googleAnalyticsId} onChange={(e) => onConfigChange({ ...config, googleAnalyticsId: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Facebook Pixel ID</Label>
              <Input placeholder="000000000000000" value={config.facebookPixelId} onChange={(e) => onConfigChange({ ...config, facebookPixelId: e.target.value })} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Integração CRM</Label>
                <div className="text-sm text-slate-600">
                  Enviar dados para CRM
                </div>
              </div>
              <Switch checked={config.crmEnabled} onCheckedChange={(v) => onConfigChange({ ...config, crmEnabled: v })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">URL de Redirecionamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Redirecionar Após Login</Label>
              <Input placeholder="https://empresa.com/obrigado" value={config.redirectAfterLoginUrl} onChange={(e) => onConfigChange({ ...config, redirectAfterLoginUrl: e.target.value })} />
              <p className="text-xs text-slate-500">Página para onde o usuário será enviado</p>
            </div>

            <div className="space-y-2">
              <Label>Redirecionar Após Logout</Label>
              <Input placeholder="https://empresa.com" value={config.redirectAfterLogoutUrl} onChange={(e) => onConfigChange({ ...config, redirectAfterLogoutUrl: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Tempo de Espera (segundos)</Label>
              <Input type="number" value={config.redirectWaitSeconds} onChange={(e) => onConfigChange({ ...config, redirectWaitSeconds: Number(e.target.value || 0) })} />
              <p className="text-xs text-slate-500">Tempo antes de redirecionar</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Abrir em Nova Aba</Label>
                <div className="text-sm text-slate-600">
                  Redirecionamento em nova aba
                </div>
              </div>
              <Switch checked={config.redirectOpenNewTab} onCheckedChange={(v) => onConfigChange({ ...config, redirectOpenNewTab: v })} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Code className="h-5 w-5" />
              CSS Customizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Adicione seu CSS personalizado</Label>
            <Textarea 
              placeholder="/* Adicione seu CSS aqui */
.login-form {
  /* seus estilos */
}

.success-page {
  /* seus estilos */
}"
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Use classes CSS personalizadas para ajustes finos
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Code className="h-5 w-5" />
              JavaScript Customizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Adicione scripts personalizados</Label>
            <Textarea 
              placeholder="// Adicione seu JavaScript aqui
// Ex: Google Tag Manager, Analytics, etc."
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Scripts serão injetados no head da página
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 border-2">
          <CardHeader>
            <CardTitle className="text-red-600">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-900">Resetar Configurações</div>
                <div className="text-sm text-slate-600">
                  Voltar para configurações padrão
                </div>
              </div>
              <Button variant="outline" onClick={() => { onConfigChange(defaultPortalLoginConfig); savePortalLoginConfig(defaultPortalLoginConfig); }}>Resetar</Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-900">Exportar Configurações</div>
                <div className="text-sm text-slate-600">
                  Baixar arquivo JSON com todas as configurações
                </div>
              </div>
              <Button variant="outline" onClick={exportConfig}>Exportar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
