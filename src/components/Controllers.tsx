import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { 
  Plus,
  MapPin,
  Wifi,
  Users,
  Activity,
  Settings,
  Power,
  RefreshCw,
  Radio
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getApiBases } from "../config/api";
import { useNavigate } from "react-router-dom";
import ControllerConfig from "./ControllerConfig";

// Remove fake controllers data; now purely backend-driven

// Replace fake data with backend-driven records
 type ControllerRecord = {
  id?: number;
  name: string;
  location?: string;
  ip: string;
  port: number;
  model?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  createdAt?: string;
};

type ControllerMetrics = {
  site?: string;
  accessPoints?: number;
  clients?: number;
  maxClients?: number;
  status?: 'online' | 'warning' | 'offline' | 'unknown';
  version?: string;
  uptime?: string;
  load?: number;
  bandwidth?: string;
};

export function Controllers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [items, setItems] = useState<ControllerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Config dialog state
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [selectedControllerId, setSelectedControllerId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState<string>("8443");
  const [model, setModel] = useState<string | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
const [metricsById, setMetricsById] = useState<Record<number, ControllerMetrics>>({});

  const formatUptime = (seconds?: number): string | undefined => {
    if (!seconds || seconds <= 0) return undefined;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h || d) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  };

  // Derived stats para cards de visão geral (usando métricas)
  const onlineCount = items.reduce((sum, c) => {
    const id = c.id as number | undefined;
    const m = id != null ? metricsById[id] : undefined;
    return sum + ((m?.status === 'online') ? 1 : 0);
  }, 0);
  const totalClients = items.reduce((sum, c) => {
    const id = c.id as number | undefined;
    const m = id != null ? metricsById[id] : undefined;
    return sum + (m?.clients || 0);
  }, 0);
  const totalAccessPoints = items.reduce((sum, c) => {
    const id = c.id as number | undefined;
    const m = id != null ? metricsById[id] : undefined;
    return sum + (m?.accessPoints || 0);
  }, 0);

  const handleDelete = async (controllerId?: number) => {
    if (!controllerId) return;
    if (!confirm("Confirmar exclusão da controladora?")) return;
    try {
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/controllers/${controllerId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({} as any));
      if (data?.success) {
        setItems((prev) => prev.filter((c) => c.id !== controllerId));
        setMetricsById((prev) => { const n = { ...prev }; delete n[controllerId]; return n; });
      } else {
        alert(data?.error || "Falha ao excluir controladora");
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir controladora");
    }
  };

  const loadMetricsFor = async (controllerId: number) => {
    try {
      const { NEST_BASE } = await getApiBases();
      // Portal config para siteId e maxClients
      let siteId = 'default';
      let maxClients: number | undefined = undefined;
      try {
        const resCfg = await fetch(`${NEST_BASE}/controllers/${controllerId}/portal-config`);
        const dataCfg = await resCfg.json().catch(() => ({} as any));
        const cfg = dataCfg?.config || {};
        siteId = cfg.siteId || 'default';
        maxClients = typeof cfg.maxClients === 'number' ? cfg.maxClients : undefined;
      } catch (_) {}

      // Sysinfo (versão e uptime reais)
      let version: string | undefined;
      let uptimeText: string | undefined;
      try {
        const resInfo = await fetch(`${NEST_BASE}/controllers/${controllerId}/sysinfo?siteId=${encodeURIComponent(siteId)}`);
        const dataInfo = await resInfo.json().catch(() => ({} as any));
        const info = dataInfo?.info || {};
        version = info?.version || info?.network_version || undefined;
        const up = Number(info?.uptime || info?.uptimeSeconds || info?.uptime_in_seconds);
        uptimeText = formatUptime(isNaN(up) ? undefined : up);
      } catch (_) {}

      // APs
      let accessPoints = 0;
      let status: ControllerMetrics['status'] = undefined;
      try {
        const resAps = await fetch(`${NEST_BASE}/controllers/${controllerId}/aps?siteId=${encodeURIComponent(siteId)}`);
        const dataAps = await resAps.json().catch(() => ({} as any));
        accessPoints = Array.isArray(dataAps?.devices) ? dataAps.devices.length : 0;
        status = resAps.ok ? 'online' : undefined;
      } catch (_) {
        status = 'warning';
      }

      // Clientes
      let clients = 0;
      try {
        const resClients = await fetch(`${NEST_BASE}/controllers/${controllerId}/clients?siteId=${encodeURIComponent(siteId)}`);
        const dataClients = await resClients.json().catch(() => ({} as any));
        clients = Array.isArray(dataClients?.clients) ? dataClients.clients.length : 0;
      } catch (_) {}

      setMetricsById((prev) => ({
        ...prev,
        [controllerId]: {
          ...(prev[controllerId] || {}),
          site: siteId,
          maxClients,
          accessPoints,
          clients,
          status,
          version: version ?? (prev[controllerId]?.version),
          uptime: uptimeText ?? (prev[controllerId]?.uptime),
        },
      }));
    } catch (_) {}
  };

  const loadAllMetrics = async () => {
    const ids = items.map((c) => c.id).filter((id): id is number => typeof id === 'number');
    await Promise.all(ids.map((id) => loadMetricsFor(id)));
  };

  const loadControllers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/controllers`);
      const data = await res.json().catch(() => ({} as any));
      setItems(Array.isArray(data.controllers) ? data.controllers : []);
      if (data?.error) setError(data.error);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar controladoras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadControllers();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      loadAllMetrics();
    }
  }, [items]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: ControllerRecord = {
        name,
        location: location || undefined,
        ip,
        port: parseInt(port || "8443", 10),
        model: model || undefined,
        username: username || undefined,
        password: password || undefined,
        apiKey: apiKey || undefined,
      };
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/controllers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({} as any));
      if (data?.controller) {
        setItems((prev) => [...prev, data.controller]);
        if (data.controller?.id) {
          const newId = Number(data.controller.id);
          loadMetricsFor(newId);
          // Abrir configurações automaticamente para permitir selecionar Site/SSID/APs imediatamente
          setSelectedControllerId(newId);
          setIsConfigDialogOpen(true);
        }
        setIsAddDialogOpen(false);
        // Reset form
        setName("");
        setLocation("");
        setIp("");
        setPort("8443");
        setModel(undefined);
        setUsername("");
        setPassword("");
        setApiKey("");
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao adicionar controladora");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Controladoras</h1>
          <p className="text-slate-600">Gerencie suas controladoras de rede</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Controladora
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Adicionar Nova Controladora</DialogTitle>
              <DialogDescription>
                Configure uma nova controladora UniFi (porta padrão 8443)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Controladora</Label>
                <Input placeholder="Ex: Controladora Filial 3" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input placeholder="Ex: Loja Shopping Sul" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Endereço IP</Label>
                  <Input placeholder="Ex: 192.168.0.10" value={ip} onChange={(e) => setIp(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input placeholder="8443" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unifi-os">UniFi OS</SelectItem>
                    <SelectItem value="cloud-key">Cloud Key</SelectItem>
                    <SelectItem value="software">Software Controller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>API Key (opcional)</Label>
                <Input placeholder="Chave de API da controladora" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !name || !ip}>
                {loading ? "Salvando..." : "Adicionar Controladora"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Total Controladoras</div>
                <div className="text-slate-900 mt-1">{items.length}</div>
              </div>
              <Wifi className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Online</div>
                <div className="text-slate-900 mt-1">{onlineCount}</div>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Clientes Total</div>
                <div className="text-slate-900 mt-1">{totalClients}</div>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Access Points</div>
                <div className="text-slate-900 mt-1">{totalAccessPoints}</div>
              </div>
              <Radio className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="text-red-600">{error}</div>
      )}

      {/* Controllers Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {items.map((controller) => (
          <Card key={controller.id} className="border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-lg ${((metricsById[controller.id || -1]?.status) === "online") ? "bg-green-50" : ((metricsById[controller.id || -1]?.status) === "warning") ? "bg-orange-50" : "bg-slate-100"}`}>
                    <Wifi className={`h-6 w-6 ${((metricsById[controller.id || -1]?.status) === "online") ? "text-green-600" : ((metricsById[controller.id || -1]?.status) === "warning") ? "text-orange-600" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900">{controller.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                      <MapPin className="h-3 w-3" />
                      {controller.location || "—"}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={((metricsById[controller.id || -1]?.status) === "online") ? "default" : "secondary"}
                  className={((metricsById[controller.id || -1]?.status) === "online") ? "bg-green-500" : ((metricsById[controller.id || -1]?.status) === "warning") ? "bg-orange-500" : "bg-slate-400"}
                >
                  {((metricsById[controller.id || -1]?.status) === "online") ? "Online" : ((metricsById[controller.id || -1]?.status) === "warning") ? "Atenção" : "—"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-600">Modelo</div>
                  <div className="text-slate-900">{controller.model || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Versão</div>
                  <div className="text-slate-900">{metricsById[controller.id || -1]?.version || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Endereço IP</div>
                  <div className="text-slate-900">{controller.ip}</div>
                </div>
                <div>
                  <div className="text-slate-600">Uptime</div>
                  <div className="text-slate-900">{metricsById[controller.id || -1]?.uptime || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Site UniFi</div>
                  <div className="text-slate-900">{metricsById[controller.id || -1]?.site || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Access Points</div>
                  <div className="text-slate-900">{metricsById[controller.id || -1]?.accessPoints != null ? `${metricsById[controller.id || -1]?.accessPoints} APs` : "—"}</div>
                </div>
              </div>

              {/* Clients Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Clientes Conectados</span>
                  <span className="text-slate-900">{metricsById[controller.id || -1]?.clients || 0} / {metricsById[controller.id || -1]?.maxClients || 0}</span>
                </div>
                <Progress 
                  value={(((metricsById[controller.id || -1]?.clients || 0) / ((metricsById[controller.id || -1]?.maxClients || 1))) * 100)}
                  className={(((metricsById[controller.id || -1]?.load || 0) > 80) ? "[&>div]:bg-orange-500" : "")}
                />
              </div>

              {/* System Load */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Carga do Sistema</span>
                  <span className="text-slate-900">{metricsById[controller.id || -1]?.load || 0}%</span>
                </div>
                <Progress 
                  value={metricsById[controller.id || -1]?.load || 0}
                  className={(((metricsById[controller.id || -1]?.load || 0) > 80) ? "[&>div]:bg-orange-500" : "")}
                />
              </div>

              {/* Stats */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-slate-600">Banda: </span>
                  <span className="text-slate-900">{metricsById[controller.id || -1]?.bandwidth || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { const id = Number(controller.id); setSelectedControllerId(id); try { localStorage.setItem('portal.selectedControllerId', String(id)); } catch (_) {} setIsConfigDialogOpen(true); }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadMetricsFor(Number(controller.id))}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => alert('Ação de energia não implementada')}>
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-slate-600">
              Nenhuma controladora cadastrada ainda.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={(open) => { setIsConfigDialogOpen(open); if (!open) setSelectedControllerId(null); }}>
        <DialogContent className="sm:max-w-[900px] w-full p-0 max-h-[85vh] overflow-auto">
          {selectedControllerId != null && (
            <ControllerConfig controllerId={selectedControllerId} onClose={() => setIsConfigDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
