import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export type ControllerRecord = {
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

export type PortalConfig = {
  siteId?: string;
  ssids?: string[];
  devices?: string[];
  primarySsid?: string;
  maxClients?: number;
  bandwidthLimitMbps?: number;
};

@Injectable()
export class ControllersService {
  private pool: Pool;
  private memory: ControllerRecord[] = [];
  private nextId = 1;
  private dbAvailable = true;
  private portalConfigs = new Map<number, PortalConfig>();
  // Nova: cache em memória para Login UI config quando DB indisponível
  private portalLoginConfigs = new Map<number, Record<string, any>>();
  // Nova: cache em memória para clientes banidos quando DB indisponível
  private bannedMemory = new Map<string, { bannedAt: string }>();

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://portal:portal@localhost:5432/portalcativo';
    this.pool = new Pool({ connectionString });
  }

  private async ensureSchema() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS controllers (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          location TEXT,
          ip TEXT NOT NULL,
          port INTEGER NOT NULL,
          model TEXT,
          username TEXT,
          password TEXT,
          api_key TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      // Nova: tabela portal_login_configs (uma config por controladora)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS portal_login_configs (
          controller_id INTEGER PRIMARY KEY REFERENCES controllers(id) ON DELETE CASCADE,
          config JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      // Nova: tabela para persistir clientes banidos por controladora/site
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS banned_clients (
          controller_id INTEGER REFERENCES controllers(id) ON DELETE CASCADE,
          site_id TEXT NOT NULL,
          mac TEXT NOT NULL,
          banned_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (controller_id, site_id, mac)
        );
      `);
      this.dbAvailable = true;
    } catch (err) {
      console.error('PostgreSQL connection/schema error:', (err as any)?.message || err);
      this.dbAvailable = false;
    }
  }

  async list(): Promise<ControllerRecord[]> {
    await this.ensureSchema();
    if (!this.dbAvailable) return this.memory;
    const res = await this.pool.query('SELECT id, name, location, ip, port, model, username, api_key as "apiKey", created_at as "createdAt" FROM controllers ORDER BY id ASC');
    return res.rows;
  }

  async get(id: number): Promise<ControllerRecord | undefined> {
    await this.ensureSchema();
    if (!this.dbAvailable) return this.memory.find(c => c.id === id);
    const res = await this.pool.query('SELECT id, name, location, ip, port, model, username, api_key as "apiKey", created_at as "createdAt" FROM controllers WHERE id=$1', [id]);
    return res.rows[0];
  }

  // Retorna a controladora com o campo password para uso interno do servidor (não enviar ao cliente)
  async getRaw(id: number): Promise<ControllerRecord | undefined> {
    await this.ensureSchema();
    if (!this.dbAvailable) return this.memory.find(c => c.id === id);
    const res = await this.pool.query('SELECT id, name, location, ip, port, model, username, password, api_key as "apiKey", created_at as "createdAt" FROM controllers WHERE id=$1', [id]);
    return res.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      const before = this.memory.length;
      this.memory = this.memory.filter(c => c.id !== id);
      this.portalConfigs.delete(id);
      this.portalLoginConfigs.delete(id);
      return this.memory.length < before;
    }
    await this.pool.query('DELETE FROM controllers WHERE id=$1', [id]);
    this.portalConfigs.delete(id);
    this.portalLoginConfigs.delete(id);
    return true;
  }

  async create(rec: ControllerRecord): Promise<ControllerRecord> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      const saved: ControllerRecord = { ...rec, id: this.nextId++, createdAt: new Date().toISOString() };
      this.memory.push(saved);
      return saved;
    }
    const res = await this.pool.query(
      `INSERT INTO controllers (name, location, ip, port, model, username, password, api_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, location, ip, port, model, username, api_key as "apiKey", created_at as "createdAt"`,
      [rec.name, rec.location || null, rec.ip, rec.port, rec.model || null, rec.username || null, rec.password || null, rec.apiKey || null]
    );
    return res.rows[0];
  }

  async update(id: number, patch: Partial<ControllerRecord>): Promise<ControllerRecord | undefined> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      const idx = this.memory.findIndex(c => c.id === id);
      if (idx === -1) return undefined;
      const current = this.memory[idx];
      const updated: ControllerRecord = {
        ...current,
        name: patch.name ?? current.name,
        location: patch.location ?? current.location,
        ip: patch.ip ?? current.ip,
        port: typeof patch.port === 'number' ? patch.port : current.port,
        model: patch.model ?? current.model,
        username: patch.username ?? current.username,
        password: patch.password ?? current.password,
        apiKey: patch.apiKey ?? current.apiKey,
      };
      this.memory[idx] = updated;
      return updated;
    }
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const add = (col: string, val: any) => { fields.push(`${col}=$${i++}`); values.push(val); };
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.location !== undefined) add('location', patch.location);
    if (patch.ip !== undefined) add('ip', patch.ip);
    if (patch.port !== undefined) add('port', patch.port);
    if (patch.model !== undefined) add('model', patch.model);
    if (patch.username !== undefined) add('username', patch.username);
    if (patch.password !== undefined) add('password', patch.password);
    if (patch.apiKey !== undefined) add('api_key', patch.apiKey);
    if (fields.length === 0) return this.get(id);
    values.push(id);
    const sql = `UPDATE controllers SET ${fields.join(', ')} WHERE id=$${i} RETURNING id, name, location, ip, port, model, username, api_key as "apiKey", created_at as "createdAt"`;
    const res = await this.pool.query(sql, values);
    return res.rows[0];
  }

  getPortalConfig(id: number): PortalConfig | undefined {
    return this.portalConfigs.get(id);
  }

  setPortalConfig(id: number, cfg: PortalConfig): PortalConfig {
    this.portalConfigs.set(id, cfg);
    return cfg;
  }

  // Nova: persistência para configuração visual do Portal Login
  async getPortalLoginConfig(id: number): Promise<Record<string, any> | undefined> {
    await this.ensureSchema();
    if (!this.dbAvailable) return this.portalLoginConfigs.get(id);
    const res = await this.pool.query('SELECT config FROM portal_login_configs WHERE controller_id=$1', [id]);
    return res.rows[0]?.config;
  }

  async setPortalLoginConfig(id: number, cfg: Record<string, any>): Promise<Record<string, any>> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      this.portalLoginConfigs.set(id, cfg);
      return cfg;
    }
    // Garante que exista uma controladora com este ID para não violar FK
    try {
      await this.pool.query(
        `INSERT INTO controllers (id, name, ip, port)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [id, 'Default Controller', '127.0.0.1', 8443]
      );
      // Ajusta a sequência para evitar colisão em futuras inserções
      await this.pool.query(
        `SELECT setval(pg_get_serial_sequence('controllers', 'id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM controllers), 1))`
      );
    } catch (_) {
      // se falhar, seguimos — o upsert abaixo pode ainda funcionar se a controladora já existir
    }
    const res = await this.pool.query(
      `INSERT INTO portal_login_configs (controller_id, config, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (controller_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
       RETURNING config`,
      [id, JSON.stringify(cfg)]
    );
    return res.rows[0]?.config ?? cfg;
  }

  // --- Persistência de clientes banidos ---
  async banClient(controllerId: number, siteId: string, mac: string): Promise<boolean> {
    await this.ensureSchema();
    const normMac = (mac || '').toLowerCase();
    if (!normMac) return false;
    if (!this.dbAvailable) {
      this.bannedMemory.set(`${controllerId}|${siteId}|${normMac}`, { bannedAt: new Date().toISOString() });
      return true;
    }
    await this.pool.query(
      `INSERT INTO banned_clients (controller_id, site_id, mac, banned_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (controller_id, site_id, mac) DO UPDATE SET banned_at=EXCLUDED.banned_at`,
      [controllerId, siteId, normMac]
    );
    return true;
  }

  async unbanClient(controllerId: number, siteId: string, mac: string): Promise<boolean> {
    await this.ensureSchema();
    const normMac = (mac || '').toLowerCase();
    if (!normMac) return false;
    if (!this.dbAvailable) {
      this.bannedMemory.delete(`${controllerId}|${siteId}|${normMac}`);
      return true;
    }
    await this.pool.query('DELETE FROM banned_clients WHERE controller_id=$1 AND site_id=$2 AND mac=$3', [controllerId, siteId, normMac]);
    return true;
  }

  async isBanned(controllerId: number, siteId: string, mac: string): Promise<boolean> {
    await this.ensureSchema();
    const normMac = (mac || '').toLowerCase();
    if (!normMac) return false;
    if (!this.dbAvailable) return this.bannedMemory.has(`${controllerId}|${siteId}|${normMac}`);
    const r = await this.pool.query('SELECT 1 FROM banned_clients WHERE controller_id=$1 AND site_id=$2 AND mac=$3 LIMIT 1', [controllerId, siteId, normMac]);
    return r.rowCount > 0;
  }

  async listBanned(controllerId: number, siteId?: string): Promise<string[]> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      const prefix = `${controllerId}|${siteId || ''}|`;
      return Array.from(this.bannedMemory.keys())
        .filter(k => k.startsWith(prefix))
        .map(k => k.split('|')[2]);
    }
    if (siteId) {
      const r = await this.pool.query('SELECT mac FROM banned_clients WHERE controller_id=$1 AND site_id=$2', [controllerId, siteId]);
      return r.rows.map((row: any) => (row.mac || '').toLowerCase());
    } else {
      const r = await this.pool.query('SELECT mac FROM banned_clients WHERE controller_id=$1', [controllerId]);
      return r.rows.map((row: any) => (row.mac || '').toLowerCase());
    }
  }
}