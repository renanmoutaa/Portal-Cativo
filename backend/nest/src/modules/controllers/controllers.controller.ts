import { Body, Controller, Get, Post, Headers, Param, Query, Delete, Patch } from '@nestjs/common';
import { ControllersService } from './controllers.service.js';
import type { ControllerRecord, PortalConfig } from './controllers.service.js';
import { UnifiService } from '../unifi/unifi.service.js';

@Controller()
export class ControllersController {
  constructor(private readonly svc: ControllersService, private readonly unifi: UnifiService) {}

  @Get('/controllers/:id')
  async get(@Param('id') id: string) {
    const num = Number(id);
    const c = await this.svc.get(num);
    if (!c) return { error: 'Not found' };
    return { controller: c, portalConfig: this.svc.getPortalConfig(num) };
  }

  @Delete('/controllers/:id')
  async remove(@Param('id') id: string) {
    const ok = await this.svc.delete(Number(id));
    return { success: ok };
  }

  @Post('/controllers')
  async create(@Body() body: ControllerRecord) {
    if (!body.name || !body.ip || !body.port) {
      return { error: 'Missing required fields: name, ip, port' };
    }
    try {
      const saved = await this.svc.create(body);

      if (saved.apiKey) {
        try {
          const sites = await this.unifi.getSites(saved);
          return { controller: saved, sites };
        } catch (err: any) {
          return { controller: saved, unifiError: err?.message || 'Failed to reach UniFi' };
        }
      }

      return { controller: saved };
    } catch (err: any) {
      return { error: err?.message || 'Failed to save controller' };
    }
  }

  @Get('/controllers/:id/sites')
  async sites(
    @Param('id') id: string,
  ) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { sites: [], error: 'Not found' };
    try {
      const sites = await this.unifi.getSites(c);
      return { sites };
    } catch (err: any) {
      return { sites: [], error: err?.message || 'Failed to list sites' };
    }
  }

  @Get('/controllers/:id/ssids')
  async ssids(
    @Param('id') id: string,
    @Query('siteId') siteId?: string,
  ) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { ssids: [], error: 'Not found' };
    if (!siteId) return { ssids: [], error: 'siteId required' };
    try {
      const ssids = await this.unifi.getSsids(c, siteId);
      return { ssids };
    } catch (err: any) {
      return { ssids: [], error: err?.message || 'Failed to list SSIDs' };
    }
  }

  @Get('/controllers/:id/aps')
  async aps(
    @Param('id') id: string,
    @Query('siteId') siteId?: string,
  ) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { devices: [], error: 'Not found' };
    if (!siteId) return { devices: [], error: 'siteId required' };
    try {
      const devices = await this.unifi.getAps(c, siteId);
      return { devices };
    } catch (err: any) {
      return { devices: [], error: err?.message || 'Failed to list devices' };
    }
  }

  @Get('/controllers/:id/clients')
  async clients(
    @Param('id') id: string,
    @Query('siteId') siteId?: string,
  ) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { clients: [], error: 'Not found' };
    if (!siteId) return { clients: [], error: 'siteId required' };
    try {
      const clients = await this.unifi.getClients(c, siteId);
      const bannedSet = new Set((await this.svc.listBanned(Number(id), siteId)).map(m => m.toLowerCase()));
      const withFlag = (Array.isArray(clients) ? clients : []).map((cl: any) => {
        const mac = String(cl?.mac || '').toLowerCase();
        const isBanned = bannedSet.has(mac);
        return { ...cl, banned: isBanned, status: cl?.status || (isBanned ? 'banido' : cl?.status) };
      });
      return { clients: withFlag };
    } catch (err: any) {
      return { clients: [], error: err?.message || 'Failed to list clients' };
    }
  }

  @Get('/controllers/:id/sysinfo')
  async sysinfo(
    @Param('id') id: string,
    @Query('siteId') siteId?: string,
  ) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { error: 'Not found' };
    if (!siteId) return { error: 'siteId required' };
    try {
      const info = await this.unifi.getSysInfo(c, siteId);
      return { info };
    } catch (err: any) {
      return { error: err?.message || 'Failed to read sysinfo' };
    }
  }

  @Get('/controllers/:id/portal-config')
  getPortalConfig(@Param('id') id: string) {
    const cfg = this.svc.getPortalConfig(Number(id));
    return { config: cfg || {} };
  }

  // Nova: configuração visual do Portal (Login UI)
  @Get('/controllers/:id/portal-login-config')
  async getPortalLoginConfig(@Param('id') id: string) {
    const cfg = await this.svc.getPortalLoginConfig(Number(id));
    return { config: cfg || {} };
  }

  @Post('/controllers/:id/portal-login-config')
  async setPortalLoginConfig(@Param('id') id: string, @Body() body: Record<string, any>) {
    const cfg = await this.svc.setPortalLoginConfig(Number(id), body || {});
    return { config: cfg };
  }

  @Patch('/controllers/:id')
  async update(@Param('id') id: string, @Body() body: Partial<ControllerRecord>) {
    const updated = await this.svc.update(Number(id), body);
    if (!updated) return { error: 'Not found' };
    return { controller: updated };
  }

  // --- Ações em clientes: desconectar, banir (bloquear) e desbanir (desbloquear) ---
  @Post('/controllers/:id/disconnect')
  async disconnect(@Param('id') id: string, @Body() body: { siteId?: string; mac?: string }) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { error: 'Not found' };
    const siteId = body?.siteId || this.svc.getPortalConfig(Number(id))?.siteId || 'default';
    const mac = String(body?.mac || '').trim();
    if (!mac) return { error: 'mac required' };
    try {
      const res = await this.unifi.disconnectClient(c, siteId, mac);
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to disconnect' };
    }
  }

  @Post('/controllers/:id/block')
  async block(@Param('id') id: string, @Body() body: { siteId?: string; mac?: string }) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { error: 'Not found' };
    const siteId = body?.siteId || this.svc.getPortalConfig(Number(id))?.siteId || 'default';
    const mac = String(body?.mac || '').trim();
    if (!mac) return { error: 'mac required' };
    try {
      const res = await this.unifi.blockClient(c, siteId, mac);
      try { await this.svc.banClient(Number(id), siteId, mac); } catch {}
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to block' };
    }
  }

  @Post('/controllers/:id/unblock')
  async unblock(@Param('id') id: string, @Body() body: { siteId?: string; mac?: string }) {
    const c = await this.svc.getRaw(Number(id));
    if (!c) return { error: 'Not found' };
    const siteId = body?.siteId || this.svc.getPortalConfig(Number(id))?.siteId || 'default';
    const mac = String(body?.mac || '').trim();
    if (!mac) return { error: 'mac required' };
    try {
      const res = await this.unifi.unblockClient(c, siteId, mac);
      try { await this.svc.unbanClient(Number(id), siteId, mac); } catch {}
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to unblock' };
    }
  }

  // Aliases semânticos
  @Post('/controllers/:id/ban')
  async ban(@Param('id') id: string, @Body() body: { siteId?: string; mac?: string }) {
    return this.block(id, body);
  }
  @Post('/controllers/:id/unban')
  async unban(@Param('id') id: string, @Body() body: { siteId?: string; mac?: string }) {
    return this.unblock(id, body);
  }

  // Revoga autorização de convidado (obriga novo login no portal)
  @Post('/controllers/:id/unauthorize')
  async unauthorize(
    @Param('id') id: string,
    @Body() body: { siteId?: string; ip?: string; mac?: string }
  ) {
    const num = Number(id);
    const c = await this.svc.getRaw(num);
    if (!c) return { error: 'Not found' };

    const portalCfg = this.svc.getPortalConfig(num);
    const siteId = body?.siteId || portalCfg?.siteId || 'default';
    if (!siteId) return { error: 'siteId required' };

    let mac = (body?.mac || '').trim();
    if (!mac && body?.ip) {
      try {
        mac = (await this.unifi.getClientMacByIp(c, siteId, body.ip)) || '';
      } catch (err: any) {
        return { error: err?.message || 'Failed to resolve MAC by IP' };
      }
    }
    if (!mac) return { error: 'mac or ip required' };

    try {
      const res = await this.unifi.unauthorizeGuest(c, siteId, mac);
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to unauthorize' };
    }
  }

  @Post('/controllers/:id/portal-config')
  setPortalConfig(@Param('id') id: string, @Body() body: PortalConfig) {
    const cfg = this.svc.setPortalConfig(Number(id), {
      siteId: body.siteId,
      ssids: Array.isArray(body.ssids) ? body.ssids : [],
      devices: Array.isArray(body.devices) ? body.devices : [],
      primarySsid: body.primarySsid,
      maxClients: typeof body.maxClients === 'number' ? body.maxClients : undefined,
      bandwidthLimitMbps: typeof body.bandwidthLimitMbps === 'number' ? body.bandwidthLimitMbps : undefined,
    });
    return { config: cfg };
  }

  // Autoriza cliente (guest) após login do portal
  @Post('/controllers/:id/authorize')
  async authorize(
    @Param('id') id: string,
    @Body() body: { 
      siteId?: string; 
      ip?: string; 
      mac?: string; 
      minutes?: number;
      apMac?: string;
      ssid?: string;
    }
  ) {
    const num = Number(id);
    const c = await this.svc.getRaw(num);
    if (!c) return { error: 'Not found' };

    // Helper: normaliza MAC (remove separadores e aplica formato aa:bb:cc:dd:ee:ff)
    const normalizeMac = (input?: string): string => {
      try {
        const s = String(input || '').trim().toLowerCase();
        if (!s) return '';
        const hex = s.replace(/[^0-9a-f]/g, '');
        if (hex.length !== 12) return s; // já deve estar no formato com separadores
        const parts = hex.match(/.{1,2}/g) || [];
        return parts.join(':');
      } catch (_) {
        return String(input || '').trim();
      }
    };

    // Normaliza possíveis MACs recebidos
    const apMacRaw = normalizeMac(body.apMac);
    let macRaw = normalizeMac(body.mac);

    const portalCfg = this.svc.getPortalConfig(num);
    let siteId = body.siteId || portalCfg?.siteId || '';

    // Se siteId não vier, tentar resolver pelo AP ou pelo SSID
    if (!siteId) {
      try {
        const sites = await this.unifi.getSites(c);
        // 1) Resolver por AP MAC
        if (apMacRaw) {
          for (const s of sites) {
            try {
              const aps = await this.unifi.getAps(c, s.id);
              const hit = aps.find((d: any) => {
                const m = String(d?.mac || d?.macAddress || '').toLowerCase();
                return m === apMacRaw;
              });
              if (hit) {
                siteId = s.id;
                break;
              }
            } catch (_) { /* continua */ }
          }
        }
        // 2) Resolver por SSID, se ainda não achou
        if (!siteId && body.ssid) {
          const desired = String(body.ssid || '').trim();
          for (const s of sites) {
            try {
              const ssids = await this.unifi.getSsids(c, s.id);
              const has = ssids.some((x: any) => {
                const name = String(x?.name || x?.id || '').trim();
                return name === desired;
              });
              if (has) {
                siteId = s.id;
                break;
              }
            } catch (_) { /* continua */ }
          }
        }
      } catch (err: any) {
        console.warn('Falha ao resolver siteId via AP/SSID:', err?.message || err);
      }
    }

    // Fallback final
    if (!siteId) siteId = 'default';

    let mac = macRaw.trim();
    if (!mac && body.ip) {
      try {
        console.log(`Resolvendo MAC para IP ${body.ip} no site ${siteId}`);
        mac = (await this.unifi.getClientMacByIp(c, siteId, body.ip)) || '';
        console.log(`MAC resolvido: ${mac || 'não encontrado'}`);
      } catch (err: any) {
        console.error('Erro ao resolver MAC por IP:', err.message);
      }
    }
    if (!mac) return { error: 'mac or ip required' };

    try {
      console.log(`Autorizando cliente ${mac} no site ${siteId}`);
      if (apMacRaw) console.log(`AP MAC: ${apMacRaw}`);
      if (body.ssid) console.log(`SSID: ${body.ssid}`);
      
      await this.unifi.authorizeGuest(c, siteId, mac, body.minutes);
      return { ok: true, mac };
    } catch (err: any) {
      console.error('Erro ao autorizar cliente:', err.message);
      return { error: err?.message || 'Failed to authorize' };
    }
  }
  
  @Get('/controllers')
  async list() {
    try {
      const controllers = await this.svc.list();
      return { controllers };
    } catch (err: any) {
      return { controllers: [], error: err?.message || 'Database unavailable' };
    }
  }

  @Post('/admin/restart')
  adminRestart(@Headers('x-admin-secret') secret?: string) {
    const expected = process.env.RESTART_SECRET || 'dev-restart';
    if ((secret || '') !== expected) {
      return { error: 'Forbidden' };
    }
    setTimeout(() => process.exit(0), 500);
    return { status: 'restarting' };
  }
}