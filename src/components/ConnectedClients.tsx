import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getAppearanceFor } from "@/config/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { 
  Search, 
  Filter, 
  Download,
  MoreVertical,
  UserX,
  Clock,
  Activity,
  RotateCcw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { getApiBases } from "@/config/api";

// Tipo para clientes conectados retornados pelo FastAPI
type ConnectedClient = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  ssid?: string | null;
  device?: string | null;
  ip?: string | null;
  mac?: string | null;
  apMac?: string | null;
  connectedSeconds?: number;
  bandwidthBytes?: number;
  createdAt?: string | null;
  status?: string | null;
  location?: string | null;
};

export function ConnectedClients() {
  const [nestBase, setNestBase] = useState("http://localhost:4002");
  const [fastapiBase, setFastapiBase] = useState("http://localhost:4001");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedControllerId, setSelectedControllerId] = useState<number>(() => {
    try { return Number(localStorage.getItem("portal.selectedControllerId") || "1") || 1; } catch (_) { return 1; }
  });
  const [siteId, setSiteId] = useState<string>("default");
  const [controllers, setControllers] = useState<Array<{ id: number; name?: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name?: string }>>([]);
  const [loadingSelectors, setLoadingSelectors] = useState(false);
  const [ssids, setSsids] = useState<string[]>([]);
  const [selectedSsid, setSelectedSsid] = useState<string>(() => {
    try { return localStorage.getItem("clients.selectedSsid") || "WIFI FREE"; } catch (_) { return "WIFI FREE"; }
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsClient, setDetailsClient] = useState<ConnectedClient | null>(null);

  // Dados reais do FastAPI (Clientes Conectados)
  const [realClients, setRealClients] = useState<ConnectedClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const filteredClients = realClients.filter((c) => {
    const hay = `${c.name || ""} ${c.email || ""} ${c.phone || ""} ${c.device || ""} ${c.ip || ""} ${c.mac || ""}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function formatDuration(seconds?: number): string {
    const s = Math.max(0, Number(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  async function savePortalConfig() {
    setSavingConfig(true);
    try {
      const { NEST_BASE } = await getApiBases();
      const res = await fetch(`${NEST_BASE}/controllers/${selectedControllerId}/portal-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, primarySsid: selectedSsid, ssids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || 'Falha ao salvar configuração');
      try { localStorage.setItem('portal.selectedSiteId', siteId); } catch(_){}
      try { localStorage.setItem('clients.selectedSsid', selectedSsid || ''); } catch(_){}
      toast.success('Configurações salvas com sucesso');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  }

  function formatBytes(bytes?: number): string {
    const b = Number(bytes || 0);
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(0)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
  }

  // Métricas dos cards
  const totalOnline = realClients.filter((c) => (c.status || "").toLowerCase() === "online").length;
  const newToday = realClients.filter((c) => {
    if (!c.createdAt) return false;
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;
  const avgSeconds = (() => {
    if (realClients.length === 0) return 0;
    const sum = realClients.reduce((acc, c) => acc + (c.connectedSeconds || 0), 0);
    return Math.floor(sum / realClients.length);
  })();
  const totalBandwidth = realClients.reduce((acc, c) => acc + (c.bandwidthBytes || 0), 0);

  // Conexões do Portal (vindas do NestJS)
  type ConnectionRecord = {
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    acceptTerms: boolean;
    token?: string;
    createdAt?: string;
  };
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [connLoading, setConnLoading] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  async function loadClients(base?: string, ssid?: string, site?: string, controllerIdParam?: number) {
    setClientsLoading(true);
    setClientsError(null);
    const desiredSsid = (ssid || selectedSsid || "WIFI FREE").trim();
    const siteToUse = (site || siteId || "default").trim();
    const ctrl = controllerIdParam ?? selectedControllerId;

    async function tryFastapi(): Promise<boolean> {
      try {
        const fpBase = base ?? fastapiBase;
        const url = new URL(`${fpBase}/clients/connected`);
        if (desiredSsid) url.searchParams.set("ssid", desiredSsid);
        if (siteToUse) url.searchParams.set("siteId", siteToUse);
        if (ctrl) url.searchParams.set("controllerId", String(ctrl));
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const list: ConnectedClient[] = Array.isArray(data?.clients) ? data.clients : [];
        if (!res.ok || data?.error) {
          return false;
        }
        setRealClients(list);
        setClientsError(null);
        return true;
      } catch (_) {
        return false;
      }
    }

    async function tryNestFallback(): Promise<boolean> {
      try {
        const { NEST_BASE } = await getApiBases();
        const url = `${NEST_BASE}/controllers/${ctrl}/clients?siteId=${encodeURIComponent(siteToUse)}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const arr = Array.isArray(data?.clients) ? data.clients : [];
        // Filtrar por SSID selecionado para não listar clientes de outras redes
        const onlySelected = arr.filter((c: any) => {
          const ss = (c?.ssid ?? c?.essid ?? c?.wlan ?? '').toString().trim();
          if (!desiredSsid) return true;
          return ss === desiredSsid;
        });
        // Mapear para o tipo esperado pela UI
        let mapped: ConnectedClient[] = onlySelected.map((c: any, idx: number) => ({
          id: idx + 1,
          name: c?.name || null,
          email: null,
          phone: null,
          ssid: c?.ssid || desiredSsid || null,
          device: c?.device || c?.hostname || c?.name || null,
          ip: c?.ip || c?.ipAddress || null,
          mac: c?.mac || c?.macAddress || null,
          apMac: c?.apMac || null,
          connectedSeconds: c?.uptimeSeconds || undefined,
          bandwidthBytes: typeof c?.bytes === 'number' ? c.bytes : undefined,
          createdAt: null,
          status: 'online',
          location: null,
        }));
        if (!res.ok) return false;
        // Tentar enriquecer com dados do formulário (FastAPI) caso disponível
        try {
          const fp = await getApiBases();
          const enrichUrl = new URL(`${fp.FASTAPI_BASE}/clients/connected`);
          if (desiredSsid) enrichUrl.searchParams.set('ssid', desiredSsid);
          if (siteToUse) enrichUrl.searchParams.set('siteId', siteToUse);
          if (ctrl) enrichUrl.searchParams.set('controllerId', String(ctrl));
          const enrRes = await fetch(enrichUrl.toString(), { cache: 'no-store' });
          const enrData = await enrRes.json().catch(() => ({}));
          const enrList: ConnectedClient[] = Array.isArray(enrData?.clients) ? enrData.clients : [];
          if (enrRes.ok && enrList.length) {
            const byMac = new Map<string, ConnectedClient>();
            enrList.forEach((it) => { const m = (it.mac || '').toLowerCase(); if (m) byMac.set(m, it); });
            mapped = mapped.map((c) => {
              const hit = byMac.get(String(c.mac || '').toLowerCase());
              if (!hit) return c;
              return {
                ...c,
                name: hit.name ?? c.name ?? null,
                email: hit.email ?? c.email ?? null,
                phone: hit.phone ?? c.phone ?? null,
                createdAt: hit.createdAt ?? c.createdAt ?? null,
                // manter demais campos do fallback (ip/bandwidth/location) quando FastAPI não os trouxer
              };
            });
          }
        } catch (_) {
          // Se não conseguir enriquecer, segue com fallback puro
        }
        setRealClients(mapped);
        setClientsError(null);
        return true;
      } catch (_) {
        return false;
      }
    }

    try {
      const okFastapi = await tryFastapi();
      if (!okFastapi) {
        const okNest = await tryNestFallback();
        if (!okNest) setClientsError("Falha ao carregar clientes");
      }
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadSsidsAndConfig() {
    try {
      const bases = await getApiBases();
      setNestBase(bases.NEST_BASE);
      setFastapiBase(bases.FASTAPI_BASE);
      const controllerId = selectedControllerId;
      // portal-config para siteId e ssid primário
      let cfgSite = "default";
      let primary: string | undefined;
      try {
        const resCfg = await fetch(`${bases.NEST_BASE}/controllers/${controllerId}/portal-config`, { cache: "no-store" });
        const dataCfg = await resCfg.json().catch(() => ({}));
        const cfg = dataCfg?.config || {};
        cfgSite = cfg?.siteId || "default";
        primary = cfg?.primarySsid || undefined;
      } catch (_) {}
      setSiteId(cfgSite);
      try { localStorage.setItem('portal.selectedSiteId', cfgSite); } catch(_){}
      // carregar SSIDs
      try {
        const res = await fetch(`${bases.NEST_BASE}/controllers/${controllerId}/ssids?siteId=${encodeURIComponent(cfgSite)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const names: string[] = (Array.isArray(data?.ssids) ? data.ssids : []).map((s: any) => s?.name || s?.id).filter((s: any) => typeof s === 'string');
        setSsids(names);
        // escolher ssid
        const persisted = (() => { try { return localStorage.getItem("clients.selectedSsid") || ""; } catch (_) { return ""; } })();
        const next = (persisted || selectedSsid || primary || "WIFI FREE");
        setSelectedSsid(next);
        try { localStorage.setItem("clients.selectedSsid", next); } catch (_) {}
        await loadClients(bases.FASTAPI_BASE, next, cfgSite, controllerId);
      } catch (_) {
        // mesmo sem lista, buscar clientes com SSID atual
        await loadClients(bases.FASTAPI_BASE, selectedSsid || primary || "WIFI FREE", cfgSite, controllerId);
      }
    } catch (err: any) {
      setClientsError(err?.message || "Falha ao resolver APIs/SSIDs");
    }
  }

  async function loadControllersAndSites() {
    setLoadingSelectors(true);
    try {
      const bases = await getApiBases();
      setNestBase(bases.NEST_BASE);
      // lista de controladoras
      let ctrls: Array<{ id: number; name?: string }> = [];
      try {
        const r = await fetch(`${bases.NEST_BASE}/controllers`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        ctrls = Array.isArray(j?.controllers) ? j.controllers : [];
      } catch {}
      setControllers(ctrls);

      // controller selecionada
      let ctrlId = selectedControllerId;
      if (!ctrlId && ctrls.length) ctrlId = Number(ctrls[0].id);
      setSelectedControllerId(ctrlId);
      try { localStorage.setItem('portal.selectedControllerId', String(ctrlId)); } catch(_){}

      // sites da controladora
      let sitesList: Array<{ id: string; name?: string }> = [];
      try {
        const r = await fetch(`${bases.NEST_BASE}/controllers/${ctrlId}/sites`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        sitesList = Array.isArray(j?.sites) ? j.sites : [];
      } catch {}
      setSites(sitesList);

      // tenta usar persistido, depois portal-config, depois primeiro site
      let nextSite = (() => { try { return localStorage.getItem('portal.selectedSiteId') || ''; } catch(_) { return ''; } })();
      if (!nextSite) {
        try {
          const r = await fetch(`${bases.NEST_BASE}/controllers/${ctrlId}/portal-config`, { cache: 'no-store' });
          const j = await r.json().catch(() => ({}));
          nextSite = (j?.config || {}).siteId || '';
        } catch {}
      }
      if (!nextSite && sitesList.length) nextSite = sitesList[0].id;
      setSiteId(nextSite || 'default');
      try { localStorage.setItem('portal.selectedSiteId', nextSite || 'default'); } catch(_){}

      // carregar SSIDs e clientes para a seleção atual
      try {
        const res = await fetch(`${bases.NEST_BASE}/controllers/${ctrlId}/ssids?siteId=${encodeURIComponent(nextSite || 'default')}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const names: string[] = (Array.isArray(data?.ssids) ? data.ssids : []).map((s: any) => s?.name || s?.id).filter((s: any) => typeof s === 'string');
        setSsids(names);
      } catch {}
      const persistedSsid = (() => { try { return localStorage.getItem('clients.selectedSsid') || ''; } catch(_) { return ''; } })();
      const nextSsid = persistedSsid || selectedSsid || 'WIFI FREE';
      setSelectedSsid(nextSsid);
      try { localStorage.setItem('clients.selectedSsid', nextSsid); } catch(_){}
      await loadClients(fastapiBase, nextSsid, nextSite || 'default', ctrlId);
    } finally {
      setLoadingSelectors(false);
    }
  }

  async function loadConnections(base?: string) {
    setConnLoading(true);
    setConnError(null);
    try {
      const res = await fetch(`${base ?? nestBase}/connections`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setConnections(Array.isArray(data?.connections) ? data.connections : []);
      setConnError(data?.error || null);
    } catch (err: any) {
      setConnError(err?.message || "Falha ao carregar conexões");
    } finally {
      setConnLoading(false);
    }
  }

  async function refreshConnections() {
    try {
      const bases = await getApiBases();
      setNestBase(bases.NEST_BASE);
      await loadConnections(bases.NEST_BASE);
    } catch (err: any) {
      setConnError(err?.message || "Falha ao resolver APIs");
    }
  }

  async function refreshClients() {
    try {
      const bases = await getApiBases();
      setFastapiBase(bases.FASTAPI_BASE);
      await loadClients(bases.FASTAPI_BASE, selectedSsid || "WIFI FREE", siteId, selectedControllerId);
    } catch (err: any) {
      setClientsError(err?.message || "Falha ao resolver APIs");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await Promise.all([refreshConnections(), loadControllersAndSites()]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-refresh removido: atualização agora é manual via botão "Atualizar"

  function exportCsv() {
    const cols = ["name","email","phone","ssid","device","ip","mac","apMac","connectedSeconds","bandwidthBytes","createdAt","status","location"];
    const rows = filteredClients.map(c => cols.map(k => {
      const v: any = (c as any)[k];
      const s = v == null ? '' : String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(','));
    const header = cols.join(',');
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const ts = new Date();
    const filename = `clientes-${(selectedSsid||'todos').replace(/\s+/g,'_')}-${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function doAction(action: 'disconnect'|'ban'|'unban'|'unauthorize', mac?: string | null) {
    if (!mac) return;
    setBusyAction(action+mac);
    try {
      const { NEST_BASE } = await getApiBases();
      const endpoint =
        action === 'disconnect' ? 'disconnect' :
        action === 'ban' ? 'block' :
        action === 'unban' ? 'unblock' :
        'unauthorize';
      const res = await fetch(`${NEST_BASE}/controllers/${selectedControllerId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, mac }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || `Falha ao ${action}`);
      // Atualização otimista de status sem refresh automático
      setRealClients((list) => list.map(c => {
        if ((c.mac || '').toLowerCase() === String(mac).toLowerCase()) {
          const next = { ...c } as ConnectedClient;
          if (action === 'ban') next.status = 'banido';
          if (action === 'unban') next.status = 'inativo';
          if (action === 'disconnect') next.status = 'inativo';
          if (action === 'unauthorize') next.status = 'inativo';
          return next;
        }
        return c;
      }));
      if (action === 'ban') toast.success('Cliente banido com sucesso');
      if (action === 'unban') toast.success('Cliente desbanido com sucesso');
      if (action === 'disconnect') toast.success('Cliente desconectado com sucesso');
      if (action === 'unauthorize') toast.success('Cliente desautorizado com sucesso');
    } catch (err: any) {
      toast.error(err?.message || `Falha ao ${action}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectAllCurrentSsid() {
    const ssid = selectedSsid || 'WIFI FREE';
    const targets = Array.from(new Set(
      realClients
        .filter((c) => (c.ssid || ssid) === ssid)
        .map((c) => String(c.mac || '').toLowerCase())
        .filter(Boolean)
    ));
    if (!targets.length) {
      toast.message('Nenhum cliente para desconectar no SSID selecionado.');
      return;
    }
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Desconectar ${targets.length} cliente(s) do SSID "${ssid}"?`);
      if (!ok) return;
    }
    setBusyAction('disconnect_all');
    let success = 0; let fail = 0;
    try {
      const { NEST_BASE } = await getApiBases();
      for (const mac of targets) {
        try {
          const res = await fetch(`${NEST_BASE}/controllers/${selectedControllerId}/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, mac }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.error) { fail++; continue; }
          success++;
        } catch (_) {
          fail++;
        }
      }
      // Atualização otimista
      setRealClients((list) => list.map((c) => targets.includes(String(c.mac || '').toLowerCase()) ? { ...c, status: 'inativo' } : c));
      if (success) toast.success(`Solicitado desconectar ${success} cliente(s) do SSID "${ssid}".`);
      if (fail) toast.error(`${fail} cliente(s) não puderam ser desconectados.`);
    } finally {
      setBusyAction(null);
    }
  }

  function openDetails(c: ConnectedClient) {
    setDetailsClient(c);
    setDetailsOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Clientes Conectados</h1>
          <p className="text-slate-600">{totalOnline} clientes ativos no momento</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de Controladora */}
          <Select
            value={String(selectedControllerId)}
            onValueChange={async (v) => {
              const idNum = Number(v);
              setSelectedControllerId(idNum);
              try { localStorage.setItem('portal.selectedControllerId', String(idNum)); } catch(_){}
              // Recarrega sites/ssids/clientes para esta controladora
              setLoadingSelectors(true);
              try {
                const { NEST_BASE } = await getApiBases();
                const r = await fetch(`${NEST_BASE}/controllers/${idNum}/sites`, { cache: 'no-store' });
                const j = await r.json().catch(() => ({}));
                const list: Array<{ id: string; name?: string }> = Array.isArray(j?.sites) ? j.sites : [];
                setSites(list);
                // escolhe site persistido ou primeiro
                let nextSite = (() => { try { return localStorage.getItem('portal.selectedSiteId') || ''; } catch(_) { return ''; } })();
                if (!nextSite && list.length) nextSite = list[0].id;
                setSiteId(nextSite || 'default');
                try { localStorage.setItem('portal.selectedSiteId', nextSite || 'default'); } catch(_){}
                // ssids
                try {
                  const r2 = await fetch(`${NEST_BASE}/controllers/${idNum}/ssids?siteId=${encodeURIComponent(nextSite || 'default')}`, { cache: 'no-store' });
                  const d2 = await r2.json().catch(() => ({}));
                  const names: string[] = (Array.isArray(d2?.ssids) ? d2.ssids : []).map((s: any) => s?.name || s?.id).filter((s: any) => typeof s === 'string');
                  setSsids(names);
                } catch {}
                const ss = (() => { try { return localStorage.getItem('clients.selectedSsid') || ''; } catch(_) { return ''; } })() || selectedSsid || 'WIFI FREE';
                setSelectedSsid(ss);
                await loadClients(undefined, ss, nextSite || 'default', idNum);
              } finally {
                setLoadingSelectors(false);
              }
            }}
          >
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione Controladora" /></SelectTrigger>
            <SelectContent>
              {controllers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name || `Controladora ${c.id}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Seletor de Site */}
          <Select
            value={siteId}
            onValueChange={async (v) => {
              setSiteId(v);
              try { localStorage.setItem('portal.selectedSiteId', v); } catch(_){}
              // recarrega ssids e clientes
              const { NEST_BASE } = await getApiBases();
              try {
                const r = await fetch(`${NEST_BASE}/controllers/${selectedControllerId}/ssids?siteId=${encodeURIComponent(v)}`, { cache: 'no-store' });
                const j = await r.json().catch(() => ({}));
                const names: string[] = (Array.isArray(j?.ssids) ? j.ssids : []).map((s: any) => s?.name || s?.id).filter((s: any) => typeof s === 'string');
                setSsids(names);
              } catch {}
              await loadClients(undefined, selectedSsid || 'WIFI FREE', v, selectedControllerId);
            }}
          >
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecione Site" /></SelectTrigger>
            <SelectContent>
              {(sites.length ? sites : [{ id: siteId, name: siteId }]).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSsid} onValueChange={(v) => { setSelectedSsid(v); try { localStorage.setItem('clients.selectedSsid', v); } catch(_){}; setPage(1); loadClients(undefined, v, siteId, selectedControllerId); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione SSID" /></SelectTrigger>
            <SelectContent>
              {(ssids.length ? ssids : [selectedSsid || 'WIFI FREE']).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refreshClients()} disabled={clientsLoading}>Atualizar</Button>
          <Button variant="destructive" onClick={disconnectAllCurrentSsid} disabled={busyAction!==null || !realClients.length}>
            Desconectar Todos
          </Button>
          <Button variant="default" onClick={savePortalConfig} disabled={savingConfig || loadingSelectors}>
            Salvar Configurações
          </Button>
          <Button className="gap-2" onClick={exportCsv} disabled={!filteredClients.length}>
            <Download className="h-4 w-4" />
            Exportar Dados
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Total Online</div>
                <div className="text-slate-900 mt-1">{totalOnline}</div>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Novos Hoje</div>
                <div className="text-slate-900 mt-1">{newToday}</div>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Tempo Médio</div>
                <div className="text-slate-900 mt-1">{formatDuration(avgSeconds)}</div>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-600 text-sm">Banda Total</div>
                <div className="text-slate-900 mt-1">{formatBytes(totalBandwidth)}</div>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="text-slate-900">Lista de Clientes</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>IP / MAC</TableHead>
                  <TableHead>Tempo Conectado</TableHead>
                  <TableHead>Banda Usada</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsLoading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="text-sm text-slate-600">Carregando clientes…</div>
                    </TableCell>
                  </TableRow>
                )}
                {!clientsLoading && clientsError && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="text-sm text-red-600">{clientsError}</div>
                    </TableCell>
                  </TableRow>
                )}
                {!clientsLoading && !clientsError && filteredClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="text-sm text-slate-600">Nenhum cliente encontrado.</div>
                    </TableCell>
                  </TableRow>
                )}
                {pagedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <div className="text-slate-900">{client.name || "—"}</div>
                        {client.email && (
                          <div className="text-sm text-slate-500">{client.email}</div>
                        )}
                        {client.phone && (
                          <div className="text-sm text-slate-500">{client.phone}</div>
                        )}
                        {!client.email && !client.phone && (
                          <div className="text-sm text-slate-500">—</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">{client.device || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-slate-900 text-sm">{client.ip || "—"}</div>
                        <div className="text-xs text-slate-500">{client.mac || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">{formatDuration(client.connectedSeconds)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">{formatBytes(client.bandwidthBytes)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-600 text-sm">{client.location || "—"}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const ap = getAppearanceFor(client.status);
                        return (
                          <Badge variant={ap.variant || 'secondary'} className={ap.className || ''}>
                            {ap.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetails(client)}>Ver Detalhes</DropdownMenuItem>
                          <DropdownMenuItem disabled>Limitar Banda</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => doAction('disconnect', client.mac)}>
                            <UserX className="h-4 w-4 mr-2" />
                            Desconectar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => doAction('unauthorize', client.mac)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Desautorizar (requer novo login)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => doAction('ban', client.mac)}>Banir</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => doAction('unban', client.mac)}>Desbanir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
             </TableBody>
           </Table>
            {/* Paginação */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="text-slate-600">{filteredClients.length} resultado(s) • Página {currentPage} de {pageCount}</div>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm"
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n}/página</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={currentPage===1}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={currentPage===pageCount}>Próxima</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conexões do Portal (persistidas) */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900">Conexões do Portal</CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-600">
                {connLoading ? "Carregando…" : `${connections.length} registro(s)`}
              </div>
              <Button variant="outline" size="sm" onClick={refreshConnections} disabled={connLoading}>
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connError && (
            <div className="text-red-600 text-sm mb-3">{connError}</div>
          )}
          <div className="space-y-4">
            {connections.map((c) => (
              <div key={c.id} className="flex items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-700">{(c.name || c.email || c.phone || "?").charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900">{c.name || "—"}</div>
                  <div className="text-xs text-slate-500 truncate">{c.email || c.phone || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                  </div>
                  {c.token && (
                    <div className="text-xs text-slate-500 truncate">{c.token}</div>
                  )}
                </div>
              </div>
            ))}
            {!connLoading && connections.length === 0 && !connError && (
              <div className="text-sm text-slate-600">Nenhuma conexão encontrada.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detalhes do Cliente */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
            <DialogDescription>Informações do dispositivo e do login</DialogDescription>
          </DialogHeader>
          {detailsClient && (
            <div className="space-y-3 text-sm">
              <div><span className="text-slate-500">Nome:</span> <span className="text-slate-900">{detailsClient.name || '—'}</span></div>
              <div><span className="text-slate-500">E-mail:</span> <span className="text-slate-900">{detailsClient.email || '—'}</span></div>
              <div><span className="text-slate-500">Número:</span> <span className="text-slate-900">{detailsClient.phone || '—'}</span></div>
              <div className="pt-2 border-t"><span className="text-slate-500">SSID:</span> <span className="text-slate-900">{detailsClient.ssid || selectedSsid || '—'}</span></div>
              <div><span className="text-slate-500">Dispositivo:</span> <span className="text-slate-900">{detailsClient.device || '—'}</span></div>
              <div><span className="text-slate-500">IP:</span> <span className="text-slate-900">{detailsClient.ip || '—'}</span></div>
              <div><span className="text-slate-500">MAC:</span> <span className="text-slate-900">{detailsClient.mac || '—'}</span></div>
              <div><span className="text-slate-500">AP MAC:</span> <span className="text-slate-900">{detailsClient.apMac || '—'}</span></div>
              <div><span className="text-slate-500">Tempo conectado:</span> <span className="text-slate-900">{formatDuration(detailsClient.connectedSeconds)}</span></div>
              <div><span className="text-slate-500">Banda usada:</span> <span className="text-slate-900">{formatBytes(detailsClient.bandwidthBytes)}</span></div>
              <div><span className="text-slate-500">Localização:</span> <span className="text-slate-900">{detailsClient.location || '—'}</span></div>
              <div><span className="text-slate-500">Desde:</span> <span className="text-slate-900">{detailsClient.createdAt ? new Date(detailsClient.createdAt).toLocaleString() : '—'}</span></div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => doAction('disconnect', detailsClient.mac)} disabled={busyAction!==null}>Desconectar</Button>
                <Button variant="outline" onClick={() => doAction('unauthorize', detailsClient.mac)} disabled={busyAction!==null}>Desautorizar</Button>
                <Button variant="destructive" onClick={() => doAction('ban', detailsClient.mac)} disabled={busyAction!==null}>Banir</Button>
                <Button variant="outline" onClick={() => doAction('unban', detailsClient.mac)} disabled={busyAction!==null}>Desbanir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
