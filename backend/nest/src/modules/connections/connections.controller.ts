import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConnectionsService } from './connections.service.js';
import type { ConnectionRecord } from './connections.service.js';

@Controller()
export class ConnectionsController {
  constructor(private svc: ConnectionsService) {}

  @Post('/connections')
  async create(@Body() body: ConnectionRecord) {
    if (!body.acceptTerms) {
      return { error: 'Terms must be accepted' };
    }
    if (!body.email && !body.phone) {
      return { error: 'Provide email or phone' };
    }
    try {
      const saved = await this.svc.create(body);
      return { connection: saved };
    } catch (err: any) {
      return { error: err?.message || 'Failed to save connection' };
    }
  }

  @Get('/connections')
  async list() {
    try {
      const connections = await this.svc.list();
      return { connections };
    } catch (err: any) {
      return { connections: [], error: err?.message || 'Database unavailable' };
    }
  }
}