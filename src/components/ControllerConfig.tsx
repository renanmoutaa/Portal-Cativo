import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { getApiBases } from "../config/api";
import { toast } from "sonner";

// Tipos simplificados para integração UniFi
type ControllerRecord = {
  id: number;
  name: string;
  location?: string;
  ip: string;
  port: number;
  model?: string;
  apiKey?: string;
  username?: string;
  password?: string;
};

type Site = { id: string; name?: string; desc?: string };

type Ssid = { id: string; name?: string; [k: string]: any };

type Device = { id?: string; name?: string; mac?: string; ip?: string; version?: string; model?: string; [k: string]: any };

type ControllerConfigProps = { controllerId?: number; onClose?: () => void };

export default function ControllerConfig({ controllerId: controllerIdProp, onClose }: ControllerConfigProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const controllerId = controllerIdProp ?? Number(id);
  const isDialog = Boolean(onClose);

  const [controller, setController] = useState<ControllerRecord | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>("");
  const [ssids, setSsids] = useState<Ssid[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedSsids, setSelectedSsids] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  // Campos de layout solicitado
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState<string>("8443");
  const [primarySsid, setPrimarySsid] = useState("");
  const [maxClients, setMaxClients] = useState<string>("");
  const [bandwidthLimit, setBandwidthLimit] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showCreds, setShowCreds] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apsAtivos = useMemo(() => devices.length, [devices]);
  const numeroRedes = useMemo(() => ssids.length, [ssids]);
  const selectedSsidsCount = useMemo(() => selectedSsids.length, [selectedSsids]);
  const selectedDevicesCount = useMemo(() => selectedDevices.length, [selectedDevices]);

  const loadController = async () => {
    setLoading(true);
    setError(null);
    try {
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/controllers/${controllerId}`);
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setController(data.controller);
      setName(data.controller?.name || "");
      setLocation(data.controller?.location || "");
      setIp(data.controller?.ip || "");
      setPort(String(data.controller?.port || 8443));
      setUsername(data.controller?.username || "");
      // senha não vem do backend por segurança; manter vazia
      // Se não houver credenciais salvas, abrir o editor automaticamente
      const missingCreds = !(data.controller?.username) && !(data.controller?.apiKey);
      if (missingCreds) setShowCreds(true);

      if (data.portalConfig) {
        setSiteId(data.portalConfig.siteId || "");
        setPrimarySsid(data.portalConfig.primarySsid || "");
        setMaxClients(
          typeof data.portalConfig.maxClients === "number" ? String(data.portalConfig.maxClients) : ""
        );
        setBandwidthLimit(
          typeof data.portalConfig.bandwidthLimitMbps === "number" ? String(data.portalConfig.bandwidthLimitMbps) : ""
        );
        if (Array.isArray(data.portalConfig.ssids)) {
          setSelectedSsids(data.portalConfig.ssids.filter((s: any) => typeof s === 'string'));
        }
        if (Array.isArray(data.portalConfig.devices)) {
          setSelectedDevices(data.portalConfig.devices.filter((d: any) => typeof d === 'string'));
        }
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar controladora");
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const { NEST_BASE } = await getApiBases();
      const params = new URLSearchParams();
      // credenciais agora são usadas do servidor; não enviar via query
      const qs = params.toString();
      const url = `${NEST_BASE}/controllers/${controllerId}/sites${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setSites(data?.sites || []);
      // Somente selecionar site automaticamente se ainda não houver site selecionado
      if (!siteId && data?.sites?.length) setSiteId(data.sites[0].id);
    } catch (err) {
      // ignorar erros leves
    }
  };

  const loadSsids = async (siteId: string) => {
    try {
      const { NEST_BASE } = await getApiBases();
      const params = new URLSearchParams({ siteId });
      // credenciais agora são usadas do servidor; não enviar via query
      const url = `${NEST_BASE}/controllers/${controllerId}/ssids?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      setSsids(data?.ssids || []);
      // Ajusta seleção para apenas SSIDs existentes no site atual
      setSelectedSsids((prev) => prev.filter((s) => (data?.ssids || []).some((w: any) => (w.id === s) || (w.name === s))));
    } catch (err) {
      // ignorar erros leves
    }
  };

  const loadDevices = async (siteId: string) => {
    try {
      const { NEST_BASE } = await getApiBases();
      const params = new URLSearchParams({ siteId });
      // credenciais agora são usadas do servidor; não enviar via query
      const url = `${NEST_BASE}/controllers/${controllerId}/aps?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      setDevices(data?.devices || []);
      // Ajusta seleção para apenas APs existentes no site atual
      setSelectedDevices((prev) => prev.filter((d) => (data?.devices || []).some((ap: any) => (ap.id === d) || (ap.mac === d))));
    } catch (err) {
      // ignorar erros leves
    }
  };

  useEffect(() => {
    if (!controllerId) return;
    loadController().then(loadSites);
  }, [controllerId]);

  // Recarrega Sites (e subsequentemente SSIDs/APs) quando credenciais são preenchidas, sem exigir salvar
  useEffect(() => {
    if (!controllerId) return;
    const hasCreds = (username && password) || (controller?.apiKey?.length);
    if (hasCreds) {
      loadSites();
    }
  }, [username, password, controller?.apiKey, controllerId]);

  useEffect(() => {
    if (!siteId) return;
    loadSsids(siteId);
    loadDevices(siteId);
    // ao mudar de site, limpa seleções até recarregar
    setSelectedSsids([]);
    setSelectedDevices([]);
  }, [siteId]);

  const saveChanges = async () => {
    setSaving(true);
    setError(null);
    try {
      const { NEST_BASE } = await getApiBases();

      // Atualiza dados básicos da controladora
      const patchBody: Partial<ControllerRecord> = {
        name,
        location: location || undefined,
        ip,
        port: parseInt(port || "8443", 10),
        username: username || undefined,
        password: password || undefined,
      };
      const resPatch = await fetch(`${NEST_BASE}/controllers/${controllerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const dataPatch = await resPatch.json();
      if (dataPatch?.error) throw new Error(dataPatch.error);

      // Salva configurações do portal
      const cfgBody = {
        siteId,
        ssids: selectedSsids,
        devices: selectedDevices,
        primarySsid: primarySsid || undefined,
        maxClients: maxClients ? parseInt(maxClients, 10) : undefined,
        bandwidthLimitMbps: bandwidthLimit ? parseInt(bandwidthLimit, 10) : undefined,
      };
      const resCfg = await fetch(`${NEST_BASE}/controllers/${controllerId}/portal-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfgBody),
      });
      const dataCfg = await resCfg.json();
      if (dataCfg?.error) throw new Error(dataCfg.error);

      toast.success("Alterações salvas com sucesso.");
      // Permanecer na tela (inclusive no diálogo) e recarregar dados
      setPassword("");
      await loadController();
      await loadSites();
      if (siteId) {
        await loadSsids(siteId);
        await loadDevices(siteId);
      }
    } catch (err: any) {
      const msg = err?.message || "Falha ao salvar alterações";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={isDialog ? "w-full" : "max-w-4xl mx-auto"}>
      <Card className={isDialog ? "rounded-none border-0 shadow-none" : "border-slate-200"}>
        <CardHeader className={(isDialog ? "rounded-none " : "") + "sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b"}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configurações • {name || controller?.name || `Controladora #${controllerId}`}</CardTitle>
              <p className="text-slate-600 text-sm">Defina Site, SSID e limites do portal</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${sites.length ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>{sites.length ? 'Conectado' : 'Aguardando conexão'}</span>
              <Button size="sm" variant="outline" onClick={() => { loadController().then(() => { loadSites(); if (siteId) { loadSsids(siteId); loadDevices(siteId); } }); }}>Atualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pb-24">
           {/* Informações Básicas */}
           <div className="space-y-4">
             <h3 className="text-slate-900 font-medium">Informações Básicas</h3>
             <div className="grid grid-cols-2 gap-5">
               <div>
                 <Label className="sr-only">Nome da Controladora</Label>
                 <Input placeholder="Nome da controladora" value={name} onChange={(e) => setName(e.target.value)} />
               </div>
               <div>
                 <Label className="sr-only">Localização</Label>
                 <Input placeholder="Localização (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
               </div>
               <div>
                 <Label className="sr-only">Endereço IP</Label>
                 <Input placeholder="IP do UniFi Controller" value={ip} onChange={(e) => setIp(e.target.value)} />
               </div>
               <div>
                 <Label className="sr-only">Porta</Label>
                 <Input placeholder="Porta (ex: 8443)" value={port} onChange={(e) => setPort(e.target.value)} />
               </div>
             </div>
           </div>

           {/* Configurações UniFi */}
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-slate-900 font-medium">Configurações UniFi</h3>
               <div className="text-xs text-slate-500">Selecione o site e quais SSIDs/APs participarão do portal.</div>
             </div>
             <div className="grid grid-cols-2 gap-5">
               <div>
                 <Label>Site UniFi</Label>
                 <Select value={siteId} onValueChange={setSiteId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o site" />
                   </SelectTrigger>
                   <SelectContent>
                     {sites.map((s) => (
                       <SelectItem key={s.id} value={s.id}>{s.name || s.desc || s.id}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label>SSID Principal</Label>
                 <Select value={primarySsid} onValueChange={setPrimarySsid}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o SSID" />
                   </SelectTrigger>
                   <SelectContent>
                     {ssids.map((w) => (
                       <SelectItem key={w.id} value={w.name || w.id}>{w.name || w.id}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="space-y-2">
                   <Label>Redes (SSIDs)</Label>
                   <Popover>
                     <PopoverTrigger asChild>
                       <Button variant="outline" className="justify-between w-full">
                         <span>{selectedSsidsCount > 0 ? `${selectedSsidsCount} selecionado(s)` : 'Selecionar SSIDs'}</span>
                         <span className="text-xs text-slate-500">{numeroRedes} no site</span>
                       </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-[320px] p-0">
                       <div className="p-3 flex items-center gap-2 border-b">
                         <Button size="sm" variant="outline" onClick={() => setSelectedSsids(ssids.map((w) => w.id || w.name || ''))}>Selecionar todos</Button>
                         <Button size="sm" variant="ghost" onClick={() => setSelectedSsids([])}>Limpar</Button>
                       </div>
                       <ScrollArea className="h-60">
                         <div className="p-3 space-y-2">
                           {ssids.map((w) => {
                             const key = w.id || w.name || '';
                             const checked = selectedSsids.includes(key);
                             return (
                               <label key={key} className="flex items-center gap-3 text-sm">
                                 <Checkbox checked={checked} onCheckedChange={(v) => {
                                   setSelectedSsids((prev) => v === true ? Array.from(new Set([...prev, key])) : prev.filter((s) => s !== key));
                                 }} />
                                 <span>{w.name || key}</span>
                               </label>
                             );
                           })}
                           {ssids.length === 0 && (
                             <div className="text-xs text-slate-500">Nenhum SSID encontrado para o site selecionado.</div>
                           )}
                         </div>
                       </ScrollArea>
                     </PopoverContent>
                   </Popover>
                 </div>

                 <div className="space-y-2">
                   <Label>Access Points (APs)</Label>
                   <Popover>
                     <PopoverTrigger asChild>
                       <Button variant="outline" className="justify-between w-full">
                         <span>{selectedDevicesCount > 0 ? `${selectedDevicesCount} selecionado(s)` : 'Selecionar APs'}</span>
                         <span className="text-xs text-slate-500">{apsAtivos} no site</span>
                       </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-[360px] p-0">
                       <div className="p-3 flex items-center gap-2 border-b">
                         <Button size="sm" variant="outline" onClick={() => setSelectedDevices(devices.map((d) => d.id || d.mac || ''))}>Selecionar todos</Button>
                         <Button size="sm" variant="ghost" onClick={() => setSelectedDevices([])}>Limpar</Button>
                       </div>
                       <ScrollArea className="h-60">
                         <div className="p-3 space-y-2">
                           {devices.map((d) => {
                             const key = d.id || d.mac || '';
                             const checked = selectedDevices.includes(key);
                             return (
                               <label key={key} className="flex items-center gap-3 text-sm">
                                 <Checkbox checked={checked} onCheckedChange={(v) => {
                                   setSelectedDevices((prev) => v === true ? Array.from(new Set([...prev, key])) : prev.filter((s) => s !== key));
                                 }} />
                                 <div className="flex flex-col">
                                   <span className="font-medium">{d.name || d.model || key}</span>
                                   <span className="text-xs text-slate-500">{d.mac || d.ip || ''}</span>
                                 </div>
                               </label>
                             );
                           })}
                           {devices.length === 0 && (
                             <div className="text-xs text-slate-500">Nenhum AP encontrado para o site selecionado.</div>
                           )}
                         </div>
                       </ScrollArea>
                     </PopoverContent>
                   </Popover>
                 </div>
               </div>
             </div>
           </div>

           {/* Limites */}
           <div className="space-y-4">
             <h3 className="text-slate-900 font-medium">Limites</h3>
             <div className="grid grid-cols-2 gap-5">
               <div>
                 <Label>Máximo de Clientes</Label>
                 <Input value={maxClients} onChange={(e) => setMaxClients(e.target.value)} />
               </div>
               <div>
                 <Label>Limite de Banda (Mbps)</Label>
                 <Input value={bandwidthLimit} onChange={(e) => setBandwidthLimit(e.target.value)} />
               </div>
             </div>
           </div>

           {/* Credenciais */}
           <div className="space-y-3">
             <div className="flex items-center justify-between">
               <h3 className="text-slate-900 font-medium">Credenciais de Acesso</h3>
               <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreds((v) => !v)}>
                 {showCreds ? 'Ocultar' : 'Editar'}
               </Button>
             </div>
             {showCreds && (
               <div className="grid grid-cols-2 gap-5">
                 <div>
                   <Label>Usuário Admin</Label>
                   <Input placeholder="usuário local ou admin UniFi" value={username} onChange={(e) => setUsername(e.target.value)} />
                 </div>
                 <div>
                   <Label>Senha</Label>
                   <Input placeholder="senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                 </div>
               </div>
             )}
             {!showCreds && (
               <p className="text-xs text-slate-500">As credenciais já salvas serão usadas para conexões. Edite apenas se necessário.</p>
             )}
           </div>

           {error && (
             <div className="text-destructive text-sm">{error}</div>
           )}

           {/* Ações */}
           <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t flex justify-end gap-3 p-4">
             <Button variant="outline" onClick={() => (onClose ? onClose() : navigate(-1))} disabled={saving || loading}>Cancelar</Button>
             <Button onClick={saveChanges} disabled={saving || loading}>Salvar Alterações</Button>
           </div>
         </CardContent>
       </Card>
     </div>
   );
}