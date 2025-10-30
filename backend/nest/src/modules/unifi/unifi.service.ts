import { Injectable } from '@nestjs/common';
import axios from 'axios';
import https from 'https';
import { ControllerRecord } from '../controllers/controllers.service.js';

@Injectable()
export class UnifiService {
  // Corrige lógica: quando ALLOW_INSECURE_TLS === 'true', devemos NÃO rejeitar certificados
  private agent = new https.Agent({ rejectUnauthorized: process.env.ALLOW_INSECURE_TLS === 'true' ? false : true });

  private baseUrl(controller: ControllerRecord) {
    const port = Number(controller.port);
    const protocol = port === 443 || port === 8443 ? 'https' : 'http';
    return `${protocol}://${controller.ip}:${controller.port}`;
  }

  private headers(controller: ControllerRecord) {
    if (controller.apiKey) {
      // API v1 oficial usa X-Api-Key
      return { 'X-Api-Key': controller.apiKey } as Record<string, string>;
    }
    if (controller.username && controller.password) {
      const token = Buffer.from(`${controller.username}:${controller.password}`).toString('base64');
      return { Authorization: `Basic ${token}` } as Record<string, string>;
    }
    return {};
  }

  // Base dos endpoints oficiais locais (Network Application)
  private v1Base(controller: ControllerRecord) {
    return `${this.baseUrl(controller)}/proxy/network/integrations/v1`;
  }

  // --- Helpers para autenticação baseada em cookie (UniFi OS/Controlador clássico) ---
  private async loginAndGetCookies(controller: ControllerRecord): Promise<{ cookieHeader: string; csrfToken?: string }> {
    if (!controller.username || !controller.password) {
      throw new Error('Username/password required for UniFi login');
    }

    const base = this.baseUrl(controller);

    // Tenta novo endpoint UniFi OS
    const tryLogin = async (url: string) => {
      const res = await axios.post(url, { username: controller.username, password: controller.password }, {
        httpsAgent: this.agent,
        headers: { 'Content-Type': 'application/json' },
        // withCredentials é ignorado no Node, mas mantemos por clareza
        withCredentials: true,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) return res;
      throw new Error(`Login failed (${res.status})`);
    };

    let res;
    try {
      res = await tryLogin(`${base}/api/auth/login`);
    } catch (_) {
      // Fallback para controladores antigos
      res = await tryLogin(`${base}/api/login`);
    }

    const setCookie = res.headers['set-cookie'] as string[] | undefined;
    if (!setCookie || setCookie.length === 0) {
      throw new Error('UniFi did not return cookies on login');
    }

    // Constrói header Cookie com pares chave=valor
    const cookieHeader = setCookie
      .map((c) => String(c).split(';')[0])
      .filter(Boolean)
      .join('; ');

    // Alguns ambientes requerem X-CSRF-Token
    const csrfFromHeader = res.headers['x-csrf-token'] as string | undefined;
    let csrfToken = csrfFromHeader;
    if (!csrfToken) {
      try {
        const ping = await axios.get(base, { httpsAgent: this.agent, headers: { Cookie: cookieHeader }, validateStatus: () => true });
        const h = ping.headers['x-csrf-token'] as string | undefined;
        if (h) csrfToken = h;
      } catch {
        // silencioso
      }
    }

    return { cookieHeader, csrfToken };
  }

  // Tenta GET em múltiplos endpoints candidatos usando sessão por cookie
  private async getWithCookie(controller: ControllerRecord, candidates: string[]) {
    const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);
    const headers: Record<string, string> = { Cookie: cookieHeader };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    for (const url of candidates) {
      const res = await axios.get(url, { httpsAgent: this.agent, headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return res.data;
      }
      if (![401, 403, 404].includes(res.status)) {
        throw new Error(`Request failed (${res.status})`);
      }
    }
    throw new Error('Nenhum endpoint disponível com cookie');
  }

  private mapSites(data: any): Array<{ id: string; name?: string; desc?: string }> {
    const arr = Array.isArray(data) ? data : (data?.data ?? []);
    return arr.map((s: any) => ({ id: s.id || s.name || s.site_name || s._id || 'default', name: s.name || s.desc || s.site_name, desc: s.desc }));
  }

  private mapSsids(data: any): Array<{ id: string; name?: string }> {
    const arr = Array.isArray(data) ? data : (data?.data ?? []);
    return arr.map((w: any) => ({ id: w.id || w._id || w.name || w.ssid, name: w.name || w.ssid }));
  }

  private mapAps(data: any): Array<{ id?: string; name?: string; mac?: string; ip?: string; version?: string; model?: string }> {
    const arr = Array.isArray(data) ? data : (data?.data ?? []);
    return arr
      .filter((d: any) => {
        const t = String(d.type || d.deviceType || d.platform || '').toLowerCase();
        const isAp = t.includes('ap') || t.includes('uap') || (d.model && String(d.model).toLowerCase().includes('ap'));
        const cat = String(d.category || '').toLowerCase();
        return isAp || cat === 'uap' || cat === 'ap' || cat.includes('ap');
      })
      .map((d: any) => ({ id: d.id || d._id || d.mac || d.macAddress, name: d.name || d.hostname || d.model, mac: d.mac || d.macAddress, ip: d.ip || d.inetAddress, version: d.version, model: d.model }));
  }

  private mapClients(data: any): any[] {
    const arr = Array.isArray(data) ? data : (data?.data ?? []);
    return arr.map((c: any) => {
      const rxBytes = c.rx_bytes ?? c.rxBytes ?? c.bytes_r ?? 0;
      const txBytes = c.tx_bytes ?? c.txBytes ?? c.bytes_t ?? 0;
      const apMac = c.ap_mac || c.apMac || c.ap_macaddr || undefined;
      const ssid = c.ssid || c.essid || c.wlan || undefined;
      const uptime = c.uptime || c.connectedDuration || c.last_seen || undefined;
      return {
        id: c._id || c.id,
        name: c.name || c.hostname || c.device_name,
        mac: c.mac || c.macAddress,
        ip: c.ip || c.ipAddress || c.lastIp,
        apMac,
        ssid,
        rxBytes: typeof rxBytes === 'number' ? rxBytes : Number(rxBytes) || 0,
        txBytes: typeof txBytes === 'number' ? txBytes : Number(txBytes) || 0,
        bytes: ((typeof rxBytes === 'number' ? rxBytes : Number(rxBytes) || 0) + (typeof txBytes === 'number' ? txBytes : Number(txBytes) || 0)),
        uptimeSeconds: typeof uptime === 'number' ? uptime : Number(uptime) || undefined,
      };
    });
  }

  async getSites(controller: ControllerRecord) {
    // Tenta primeiro a API oficial (integrations v1)
    const url = `${this.v1Base(controller)}/sites`;
    try {
      const res = await axios.get(url, { httpsAgent: this.agent, headers: this.headers(controller), validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return this.mapSites(list);
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (_) {
      // Fallback via cookie (controladores antigos)
      const base = this.baseUrl(controller);
      const data = await this.getWithCookie(controller, [
        `${base}/proxy/network/api/self/sites`,
        `${base}/api/self/sites`,
      ]);
      return this.mapSites(data);
    }
  }

  async getSsids(controller: ControllerRecord, siteId: string) {
    // API v1 oficial: tente alguns caminhos conhecidos
    const candidates = [
      `${this.v1Base(controller)}/sites/${encodeURIComponent(siteId)}/wireless-networks`,
      `${this.v1Base(controller)}/sites/${encodeURIComponent(siteId)}/ssids`,
    ];
    for (const url of candidates) {
      try {
        const res = await axios.get(url, { httpsAgent: this.agent, headers: this.headers(controller), validateStatus: () => true });
        if (res.status >= 200 && res.status < 300) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
          return this.mapSsids(list);
        }
      } catch (_) {
        // tenta o próximo
      }
    }
    // Fallback (legacy): wlanconf via cookie
    const base = this.baseUrl(controller);
    const data = await this.getWithCookie(controller, [
      `${base}/proxy/network/api/s/${siteId}/list/wlanconf`,
      `${base}/api/s/${siteId}/list/wlanconf`,
    ]);
    return this.mapSsids(data);
  }

  async getAps(controller: ControllerRecord, siteId: string) {
    // API v1 oficial (devices)
    const url = `${this.v1Base(controller)}/sites/${encodeURIComponent(siteId)}/devices`;
    try {
      const res = await axios.get(url, { httpsAgent: this.agent, headers: this.headers(controller), validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return this.mapAps(list);
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (_) {
      // Fallback (legacy): stat/device via cookie
      const base = this.baseUrl(controller);
      const data = await this.getWithCookie(controller, [
        `${base}/proxy/network/api/s/${siteId}/stat/device`,
        `${base}/api/s/${siteId}/stat/device`,
      ]);
      return this.mapAps(data);
    }
  }

  // Lista clientes de um site
  async getClients(controller: ControllerRecord, siteId: string) {
    // API v1 oficial (clients)
    const url = `${this.v1Base(controller)}/sites/${encodeURIComponent(siteId)}/clients`;
    try {
      const res = await axios.get(url, { httpsAgent: this.agent, headers: this.headers(controller), validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return this.mapClients(list);
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (_) {
      // Fallback (legacy)
      const base = this.baseUrl(controller);
      const data = await this.getWithCookie(controller, [
        `${base}/proxy/network/api/s/${siteId}/stat/sta`,
        `${base}/api/s/${siteId}/stat/sta`,
      ]);
      return this.mapClients(data);
    }
  }

  // Resolve MAC de um cliente a partir do IP
  async getClientMacByIp(controller: ControllerRecord, siteId: string, ip: string): Promise<string | undefined> {
    const clients = await this.getClients(controller, siteId);
    const hit = clients.find((c: any) => {
      const ipAddr = c.ipAddress || c.ip || c.lastIp || c.ipv4 || '';
      return String(ipAddr).trim() === String(ip).trim();
    });
    return hit?.macAddress || hit?.mac || undefined;
  }

  // Informações do controlador (versão, uptime) — via cookie
  async getSysInfo(controller: ControllerRecord, siteId: string) {
    const base = this.baseUrl(controller);
    const data = await this.getWithCookie(controller, [
      `${base}/proxy/network/api/s/${siteId}/stat/sysinfo`,
      `${base}/api/s/${siteId}/stat/sysinfo`,
    ]);
    const obj = Array.isArray(data?.data) ? data.data[0] : (Array.isArray(data) ? data[0] : data);
    return {
      version: obj?.version || obj?.network_version || obj?.build || obj?.applicationVersion,
      uptime: obj?.uptime || obj?.uptime_in_seconds || obj?.uptimeSeconds || obj?.system_uptime,
      raw: obj || data,
    };
  }

  // Autoriza convidado (guest) usando sessão autenticada (cookie) e cmd/stamgr
  async authorizeGuest(controller: ControllerRecord, siteId: string, mac: string, minutes?: number) {
    // Primeiro tenta sessão com cookie (mais compatível com UniFi OS)
    try {
      const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);

      const payload: any = { cmd: 'authorize-guest', mac, minutes: minutes ?? 120 };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      // Em UniFi OS, a Network App fica atrás de /proxy/network
      const base = this.baseUrl(controller);
      const candidates = [
        `${base}/proxy/network/api/s/${siteId}/cmd/stamgr`,
        `${base}/api/s/${siteId}/cmd/stamgr`,
      ];

      for (const url of candidates) {
        const res = await axios.post(url, payload, {
          httpsAgent: this.agent,
          headers,
          validateStatus: () => true,
        });
        if (res.status >= 200 && res.status < 300) {
          console.log(`[UniFi] authorize-guest via cookie OK: ${url} (site=${siteId}, mac=${mac})`);
          return Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data);
        }
        // Tenta próximo candidato se 404/401
        if (![401, 403, 404].includes(res.status)) {
          // Outro erro — interrompe com mensagem
          throw new Error(`Authorization failed (${res.status})`);
        }
        console.warn(`[UniFi] authorize-guest via cookie falhou (${res.status}) em ${url}`);
      }

      throw new Error('Nenhum endpoint de autorização disponível (proxy/network ou direto)');
    } catch (cookieErr: any) {
      // Como último recurso, tenta API v1 moderna com Authorization header
      try {
        const clients = await this.getClients(controller, siteId);
        const client = clients.find((c: any) => {
          const clientMac = c.macAddress || c.mac || '';
          return String(clientMac).toLowerCase().trim() === String(mac).toLowerCase().trim();
        });
        if (!client || !client.id) {
          throw new Error(`Cliente com MAC ${mac} não encontrado`);
        }
        const url = `${this.v1Base(controller)}/sites/${encodeURIComponent(siteId)}/clients/${encodeURIComponent(client.id)}/actions`;
        const res = await axios.post(url, {
          action: 'AUTHORIZE_GUEST_ACCESS',
          timeLimitMinutes: minutes ?? 120,
        }, { httpsAgent: this.agent, headers: this.headers(controller) });
        console.log(`[UniFi] authorize-guest via v1 OK: ${url} (site=${siteId}, mac=${mac}, clientId=${client.id})`);
        return res.data;
      } catch (err: any) {
        // Mantém erro original de cookie para facilitar diagnóstico
        const msg = cookieErr?.message || err?.message || 'Falha na autorização';
        console.error('Falha na autorização (cookie/v1):', msg);
        throw new Error(msg);
      }
    }
  }

  // Revoga a autorização de convidado (unauthorize-guest)
  async unauthorizeGuest(controller: ControllerRecord, siteId: string, mac: string) {
    // Primeiro tenta sessão com cookie (mais compatível com UniFi OS)
    const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const base = this.baseUrl(controller);
    const payload = { cmd: 'unauthorize-guest', mac } as any;
    const candidates = [
      `${base}/proxy/network/api/s/${siteId}/cmd/stamgr`,
      `${base}/api/s/${siteId}/cmd/stamgr`,
    ];
    for (const url of candidates) {
      const res = await axios.post(url, payload, { httpsAgent: this.agent, headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data);
      }
      if (![401, 403, 404].includes(res.status)) {
        throw new Error(`Unauthorize failed (${res.status})`);
      }
    }
    // Como fallback, tentaria API v1 se soubéssemos a ação exata; manter cookie-flow por compatibilidade
    throw new Error('Nenhum endpoint de desautorização disponível');
  }

  // Desconecta cliente (kick-sta)
  async disconnectClient(controller: ControllerRecord, siteId: string, mac: string) {
    const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Cookie: cookieHeader };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const base = this.baseUrl(controller);
    const payload = { cmd: 'kick-sta', mac };
    const candidates = [
      `${base}/proxy/network/api/s/${siteId}/cmd/stamgr`,
      `${base}/api/s/${siteId}/cmd/stamgr`,
    ];
    for (const url of candidates) {
      const res = await axios.post(url, payload, { httpsAgent: this.agent, headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) return res.data;
      if (![401,403,404].includes(res.status)) throw new Error(`Disconnect failed (${res.status})`);
    }
    throw new Error('Nenhum endpoint de desconexão disponível');
  }

  // Bloqueia cliente (block-sta)
  async blockClient(controller: ControllerRecord, siteId: string, mac: string) {
    const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Cookie: cookieHeader };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const base = this.baseUrl(controller);
    const payload = { cmd: 'block-sta', mac };
    const candidates = [
      `${base}/proxy/network/api/s/${siteId}/cmd/stamgr`,
      `${base}/api/s/${siteId}/cmd/stamgr`,
    ];
    for (const url of candidates) {
      const res = await axios.post(url, payload, { httpsAgent: this.agent, headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) return res.data;
      if (![401,403,404].includes(res.status)) throw new Error(`Block failed (${res.status})`);
    }
    throw new Error('Nenhum endpoint de bloqueio disponível');
  }

  // Desbloqueia cliente (unblock-sta)
  async unblockClient(controller: ControllerRecord, siteId: string, mac: string) {
    const { cookieHeader, csrfToken } = await this.loginAndGetCookies(controller);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Cookie: cookieHeader };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const base = this.baseUrl(controller);
    const payload = { cmd: 'unblock-sta', mac };
    const candidates = [
      `${base}/proxy/network/api/s/${siteId}/cmd/stamgr`,
      `${base}/api/s/${siteId}/cmd/stamgr`,
    ];
    for (const url of candidates) {
      const res = await axios.post(url, payload, { httpsAgent: this.agent, headers, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) return res.data;
      if (![401,403,404].includes(res.status)) throw new Error(`Unblock failed (${res.status})`);
    }
    throw new Error('Nenhum endpoint de desbloqueio disponível');
  }
}