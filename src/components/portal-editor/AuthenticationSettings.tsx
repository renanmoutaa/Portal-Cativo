import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Globe, Smartphone, Mail, Key, FileText } from "lucide-react";
import { Separator } from "../ui/separator";
import { PortalLoginConfig } from "../../portal/config";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

export function AuthenticationSettings({ config, onConfigChange }: { config: PortalLoginConfig; onConfigChange: (cfg: PortalLoginConfig) => void }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Autenticação</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="methods">
                <AccordionTrigger className="text-sm">Métodos de Login</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Login com Facebook</Label>
                        <div className="text-sm text-slate-600">Autenticação via rede social</div>
                      </div>
                    </div>
                    <Switch checked={config.enableFacebook} onCheckedChange={(v) => onConfigChange({ ...config, enableFacebook: v })} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Login com Google</Label>
                        <div className="text-sm text-slate-600">Autenticação via conta Google</div>
                      </div>
                    </div>
                    <Switch checked={config.enableGoogle} onCheckedChange={(v) => onConfigChange({ ...config, enableGoogle: v })} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Login com Instagram</Label>
                        <div className="text-sm text-slate-600">Autenticação via Instagram</div>
                      </div>
                    </div>
                    <Switch checked={config.enableInstagram} onCheckedChange={(v) => onConfigChange({ ...config, enableInstagram: v })} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Login com SMS</Label>
                        <div className="text-sm text-slate-600">Código via mensagem de texto</div>
                      </div>
                    </div>
                    <Switch checked={config.enableSMS} onCheckedChange={(v) => onConfigChange({ ...config, enableSMS: v })} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Mail className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Login com Email</Label>
                        <div className="text-sm text-slate-600">Email e senha tradicional</div>
                      </div>
                    </div>
                    <Switch checked={config.enableEmail} onCheckedChange={(v) => onConfigChange({ ...config, enableEmail: v })} />
                  </div>

                  {/* Novo método: Formulário */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Formulário</Label>
                        <div className="text-sm text-slate-600">Habilitar formulário de dados (email/telefone)</div>
                      </div>
                    </div>
                    <Switch checked={config.enableForm} onCheckedChange={(v) => onConfigChange({ ...config, enableForm: v })} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                        <Key className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label>Voucher / Código</Label>
                        <div className="text-sm text-slate-600">Acesso via código pré-gerado</div>
                      </div>
                    </div>
                    <Switch checked={config.enableVoucher} onCheckedChange={(v) => onConfigChange({ ...config, enableVoucher: v })} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="oauth">
                <AccordionTrigger className="text-sm">Credenciais OAuth</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Facebook App ID</Label>
                    <Input placeholder="Digite o App ID do Facebook" value={config.facebookAppId} onChange={(e) => onConfigChange({ ...config, facebookAppId: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Facebook App Secret</Label>
                    <Input type="password" placeholder="Digite o App Secret" value={config.facebookAppSecret} onChange={(e) => onConfigChange({ ...config, facebookAppSecret: e.target.value })} />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Google Client ID</Label>
                    <Input placeholder="Digite o Client ID do Google" value={config.googleClientId} onChange={(e) => onConfigChange({ ...config, googleClientId: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Google Client Secret</Label>
                    <Input type="password" placeholder="Digite o Client Secret" value={config.googleClientSecret} onChange={(e) => onConfigChange({ ...config, googleClientSecret: e.target.value })} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Formulário e Validações</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="fields">
                <AccordionTrigger className="text-sm">Campos do Formulário</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {([
                    { key: "fullName", label: "Nome Completo", required: true },
                    { key: "email", label: "Email", required: true },
                    { key: "phone", label: "Telefone", required: true },
                    { key: "birthDate", label: "Data de Nascimento", required: false },
                    { key: "cpf", label: "CPF", required: false },
                    { key: "gender", label: "Gênero", required: false },
                    { key: "postalCode", label: "Código Postal", required: false },
                    { key: "company", label: "Empresa", required: false },
                    { key: "jobTitle", label: "Cargo", required: false },
                  ] as const).map((field) => (
                    <div key={field.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Label>{field.label}</Label>
                        {field.required && (
                          <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                        )}
                      </div>
                      <Switch
                        checked={config.fields[field.key as keyof PortalLoginConfig["fields"]]}
                        onCheckedChange={(v) => onConfigChange({
                          ...config,
                          fields: { ...config.fields, [field.key]: v },
                        })}
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="validation">
                <AccordionTrigger className="text-sm">Validações</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Validar Email</Label>
                      <div className="text-sm text-slate-600">Verificar formato de email</div>
                    </div>
                    <Switch checked={config.validateEmail} onCheckedChange={(v) => onConfigChange({ ...config, validateEmail: v })} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Validar CPF</Label>
                      <div className="text-sm text-slate-600">Verificar CPF válido</div>
                    </div>
                    <Switch checked={config.validateCpf} onCheckedChange={(v) => onConfigChange({ ...config, validateCpf: v })} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Validar Telefone</Label>
                      <div className="text-sm text-slate-600">Formato brasileiro (11) 99999-9999</div>
                    </div>
                    <Switch checked={config.validatePhone} onCheckedChange={(v) => onConfigChange({ ...config, validatePhone: v })} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Único</Label>
                      <div className="text-sm text-slate-600">Não permitir emails duplicados</div>
                    </div>
                    <Switch checked={config.uniqueEmail} onCheckedChange={(v) => onConfigChange({ ...config, uniqueEmail: v })} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
