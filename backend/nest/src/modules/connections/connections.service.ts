import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export type ConnectionRecord = {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  acceptTerms: boolean;
  token?: string;
  createdAt?: string;
};

@Injectable()
export class ConnectionsService {
  private pool: Pool;
  private dbAvailable = true;
  private memory: ConnectionRecord[] = [];
  private nextId = 1;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://portal:portal@localhost:5432/portalcativo';
    // Log para diagnosticar a origem da conexão
    console.log('[ConnectionsService] DATABASE_URL =', process.env.DATABASE_URL);
    console.log('[ConnectionsService] connectionString =', connectionString);
    this.pool = new Pool({ connectionString });
  }

  private async ensureSchema() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS connections (
          id SERIAL PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          accept_terms BOOLEAN NOT NULL,
          token TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      this.dbAvailable = true;
    } catch (err) {
      console.error('[ConnectionsService] PostgreSQL unavailable:', (err as any)?.message || err);
      this.dbAvailable = false;
    }
  }

  async create(rec: ConnectionRecord): Promise<ConnectionRecord> {
    await this.ensureSchema();
    if (!this.dbAvailable) {
      const saved: ConnectionRecord = {
        id: this.nextId++,
        name: rec.name || null || undefined,
        email: rec.email || null || undefined,
        phone: rec.phone || null || undefined,
        acceptTerms: !!rec.acceptTerms,
        token: rec.token || undefined,
        createdAt: new Date().toISOString(),
      };
      this.memory.unshift(saved);
      return saved;
    }
    const res = await this.pool.query(
      `INSERT INTO connections (name, email, phone, accept_terms, token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, accept_terms as "acceptTerms", token, created_at as "createdAt"`,
      [rec.name || null, rec.email || null, rec.phone || null, !!rec.acceptTerms, rec.token || null]
    );
    return res.rows[0];
  }

  async list(): Promise<ConnectionRecord[]> {
    await this.ensureSchema();
    if (!this.dbAvailable) return this.memory;
    const res = await this.pool.query(
      `SELECT id, name, email, phone, accept_terms as "acceptTerms", token, created_at as "createdAt"
       FROM connections ORDER BY id DESC`
    );
    return res.rows;
  }
}