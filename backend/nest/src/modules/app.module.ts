import { Module } from '@nestjs/common';
import { ControllersModule } from '../modules/controllers/controllers.module.js';
import { UnifiModule } from '../modules/unifi/unifi.module.js';
import { ConnectionsModule } from '../modules/connections/connections.module.js';

@Module({
  imports: [ControllersModule, UnifiModule, ConnectionsModule],
})
export class AppModule {}