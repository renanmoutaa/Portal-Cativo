import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { 
  Users, 
  Wifi, 
  TrendingUp, 
  Activity,
  ArrowUp,
  ArrowDown,
  Clock,
  Server
} from "lucide-react";
import { Progress } from "./ui/progress";
import { getApiBases } from "@/config/api";

export function DashboardOverview() {
  // Serviço: estados e checagem
  const [services, setServices] = useState({
    frontend: { name: "Frontend", url: typeof window !== "undefined" ? window.location.origin : "http://localhost:4000", up: true },
    fastapi: { name: "FastAPI", url: "http://localhost:4001", up: false },
    nest: { name: "NestJS", url: "http://localhost:4002", up: false },
  });
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [busyFastapi, setBusyFastapi] = useState(false);
  const [busyNest, setBusyNest] = useState(false);

  // Dados reais
  type Client = { email?: string|null; phone?: string|null; name?: string|null; bandwidthBytes?: number; connectedSeconds?: number };
  const [clients, setClients] = useState<Client[]>([]);
  const [recent, setRecent] = useState<Array<{ name?: string|null; email?: string|null; phone?: string|null; createdAt?: string }>>([]);
  const [ctrls, setCtrls] = useState<Array<{ id: number; name?: string }>>([]);
  const [ctrlMetrics, setCtrlMetrics] = useState<Record<number, { clients: number; load: number; status: "online"|"warning"|"offline" }>>({});

  function formatBytes(n?: number) {
    const v = n || 0;
    const units = ["B","KB","MB","GB","TB"]; let i = 0; let x = v;
    while (x >= 1024 && i < units.length-1) { x /= 1024; i++; }
    return `${x.toFixed(i===0?0:1)} ${units[i]}`;
  }

  function formatSince(dt?: string) {
    if (!dt) return "—";
    const ms = Date.now() - new Date(dt).getTime();
    const m = Math.max(0, Math.floor(ms/60000));
    if (m < 60) return `${m}m`;
    const h = Math.floor(m/60); const mm = m%60; return `${h}h ${mm}m`;
  }

  // Carrega dados reais simples: clientes conectados, conexões recentes e controladoras
  async function loadRealData() {
    try {
      const { FASTAPI_BASE, NEST_BASE } = await getApiBases();
      // clientes conectados (sem filtros -> todos)
      try {
        const r = await fetch(`${FASTAPI_BASE}/clients/connected`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        setClients(Array.isArray(j?.clients) ? j.clients : []);
      } catch {}
      // conexões recentes
      try {
        const r = await fetch(`${NEST_BASE}/connections`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j?.connections) ? j.connections : [];
        // ordenar por createdAt desc, limitar 8
        list.sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
        setRecent(list.slice(0, 8));
      } catch {}
      // controladoras
      try {
        const r = await fetch(`${NEST_BASE}/controllers`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        setCtrls(Array.isArray(j?.controllers) ? j.controllers : []);
      } catch {}
    } catch {}
  }

  // Enriquecer métricas por controladora (clientes/"load") usando portal-config quando possível
  async function hydrateControllerMetrics() {
    try {
      const { NEST_BASE } = await getApiBases();
      const out: Record<number, { clients: number; load: number; status: "online"|"warning"|"offline" }> = {};
      for (const c of ctrls) {
        const id = Number(c.id);
        let siteId = "default";
        try {
          const rCfg = await fetch(`${NEST_BASE}/controllers/${id}/portal-config`, { cache: "no-store" });
          const jCfg = await rCfg.json().catch(() => ({}));
          siteId = (jCfg?.config || {}).siteId || "default";
        } catch {}
        // clientes no site
        let cliCount = 0;
        try {
          const rCli = await fetch(`${NEST_BASE}/controllers/${id}/clients?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
          const jCli = await rCli.json().catch(() => ({}));
          cliCount = Array.isArray(jCli?.clients) ? jCli.clients.length : 0;
        } catch {}
        // carga do sistema (melhor esforço)
        let load = 0; let status: "online"|"warning"|"offline" = "online";
        try {
          const rInfo = await fetch(`${NEST_BASE}/controllers/${id}/sysinfo?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
          const jInfo = await rInfo.json().catch(() => ({}));
          const info: any = jInfo?.info || {};
          const cpu = Number((info?.system_stats || info?.cpu || {}).cpu ? (info.system_stats.cpu) : 0);
          if (!isNaN(cpu) && cpu > 0) load = Math.min(100, Math.round(cpu));
          status = "online";
        } catch {
          status = "warning"; // ainda consideramos online sem sysinfo
        }
        out[id] = { clients: cliCount, load, status };
      }
      setCtrlMetrics(out);
    } catch {}
  }

  async function restartFastapi() {
    setBusyFastapi(true);
    try {
      const { FASTAPI_BASE } = await getApiBases();
      const res = await fetch(`${FASTAPI_BASE}/admin/restart`, {
        method: "POST",
        headers: { "X-Admin-Secret": "dev-restart" },
      });
      await res.json().catch(() => ({}));
      await checkServices();
    } catch {
      // silencia; status será refletido em checkServices
    } finally {
      setBusyFastapi(false);
    }
  }

  async function restartNest() {
    setBusyNest(true);
    try {
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/admin/restart`, {
        method: "POST",
        headers: { "X-Admin-Secret": "dev-restart" },
      });
      await res.json().catch(() => ({}));
      await checkServices();
    } catch {
      // silencia
    } finally {
      setBusyNest(false);
    }
  }

  const checkServices = async () => {
    setChecking(true);
    try {
      let fastapiUp = false;
      let nestUp = false;
      let fastapiUrl = services.fastapi.url;
      let nestUrl = services.nest.url;
      try {
        const { FASTAPI_BASE, NEST_BASE } = await getApiBases();
        fastapiUrl = FASTAPI_BASE;
        nestUrl = NEST_BASE;
        const res = await fetch(`${FASTAPI_BASE}/health`, { cache: "no-store" });
        fastapiUp = res.ok;
      } catch (_) {
        fastapiUp = false;
      }
      try {
        await fetch(`${nestUrl}/controllers`, { cache: "no-store" });
        nestUp = true;
      } catch (_) {
        nestUp = false;
      }
      setServices({
        frontend: { ...services.frontend, up: true },
        fastapi: { name: "FastAPI", url: fastapiUrl, up: fastapiUp },
        nest: { name: "NestJS", url: nestUrl, up: nestUp },
      });
    } finally {
      setChecking(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkServices();
  }, []);

  useEffect(() => {
    loadRealData();
  }, []);

  useEffect(() => {
    if (ctrls.length) hydrateControllerMetrics();
  }, [ctrls]);

  const totalBandwidth = useMemo(() => clients.reduce((acc, c) => acc + (c.bandwidthBytes || 0), 0), [clients]);
  const connectionsToday = useMemo(() => recent.filter(r => {
    if (!r.createdAt) return false; const d = new Date(r.createdAt); const now = new Date();
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  }), [recent]);
  const conversionPct = useMemo(() => {
    const denom = Math.max(1, connectionsToday.length);
    return `${Math.round((clients.length/denom)*100)}%`;
  }, [clients.length, connectionsToday.length]);

  const stats = useMemo(() => ([
    { title: "Clientes Conectados", value: String(clients.length), change: "—", trend: "up", icon: Users, color: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "Controladoras Ativas", value: String(ctrls.length), change: "—", trend: "up", icon: Wifi, color: "text-green-600", bgColor: "bg-green-50" },
    { title: "Taxa de Conversão", value: conversionPct, change: "—", trend: "up", icon: TrendingUp, color: "text-purple-600", bgColor: "bg-purple-50" },
    { title: "Banda Utilizada", value: formatBytes(totalBandwidth), change: "—", trend: "up", icon: Activity, color: "text-orange-600", bgColor: "bg-orange-50" },
  ]), [clients.length, ctrls.length, totalBandwidth, conversionPct]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Visão geral do sistema de hotspot</p>
        </div>
        <div>
          <Button variant="outline" onClick={() => { loadRealData(); }}>
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Status dos Serviços */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-slate-900">Status dos Serviços</CardTitle>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-xs text-slate-500">Última verificação: {lastChecked.toLocaleTimeString()}</span>
            )}
            <Button size="sm" variant="outline" onClick={checkServices} disabled={checking}>
              {checking ? "Verificando..." : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[services.frontend, services.fastapi, services.nest].map((svc, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <Server className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-900">{svc.name}</div>
                    <div className="text-xs text-slate-500 truncate">{svc.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${svc.up ? "bg-green-500" : "bg-red-500"}`} />
                  <span className={`text-xs ${svc.up ? "text-green-600" : "text-red-600"}`}>
                    {svc.up ? "Online" : "Offline"}
                  </span>
                  {svc.name === "FastAPI" && (
                    <Button variant="outline" size="sm" onClick={restartFastapi} disabled={busyFastapi}>
                      {busyFastapi ? "Reiniciando…" : "Reiniciar"}
                    </Button>
                  )}
                  {svc.name === "NestJS" && (
                    <Button variant="outline" size="sm" onClick={restartNest} disabled={busyNest}>
                      {busyNest ? "Reiniciando…" : "Reiniciar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? ArrowUp : ArrowDown;
          return (
            <Card key={index} className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${stat.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    stat.trend === "up" ? "text-green-600" : "text-red-600"
                  }`}>
                    <TrendIcon className="h-4 w-4" />
                    {stat.change}
                  </div>
                </div>
                <div className="text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-600">{stat.title}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Connections */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Conexões Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recent.map((rec, index) => {
                const match = clients.find(c => (rec.email && c.email && rec.email===c.email) || (rec.phone && c.phone && rec.phone===c.phone));
                const status = match ? "online" : "offline";
                const name = rec.name || rec.email || rec.phone || "—";
                const bandwidth = match ? formatBytes(match.bandwidthBytes) : "0 B";
                const duration = match ? `${Math.max(1, Math.floor((match.connectedSeconds||0)/60))}m` : formatSince(rec.createdAt);
                return (
                <div key={index} className="flex items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-700">{String(name).charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900">{name}</div>
                    <div className="text-xs text-slate-500 truncate">{rec.email || rec.phone || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {duration}
                      </div>
                      <div className="text-xs text-slate-500">{bandwidth}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      status === "online" ? "bg-green-500" : "bg-slate-300"
                    }`} />
                  </div>
                </div>
              );})}
            </div>
          </CardContent>
        </Card>

        {/* Controllers Status */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Status das Controladoras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {ctrls.map((controller: any, index) => {
                const id = Number(controller.id);
                const m = ctrlMetrics[id] || { clients: 0, load: 0, status: "online" as const };
                return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-slate-900">{controller.name || `Controladora ${id}`}</div>
                      <div className="text-xs text-slate-500">ID {id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-900">{m.clients} clientes</div>
                      <div className={`text-xs ${
                        m.status === "online" ? "text-green-600" : "text-orange-600"
                      }`}>
                        {m.status === "online" ? "Online" : "Atenção"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Carga do sistema</span>
                      <span>{m.load}%</span>
                    </div>
                    <Progress 
                      value={m.load} 
                      className={m.load > 80 ? "bg-slate-100 [&>div]:bg-orange-500" : ""}
                    />
                  </div>
                </div>
              );})}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Traffic Chart */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Tráfego de Rede (Últimas 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2">
            {[45, 52, 48, 65, 58, 72, 68, 75, 70, 82, 78, 85, 80, 88, 92, 87, 90, 95, 88, 92, 85, 78, 70, 65].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                <div
                  className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ height: `${height}%` }}
                  title={`${i}:00 - ${height}% utilização`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-4">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
