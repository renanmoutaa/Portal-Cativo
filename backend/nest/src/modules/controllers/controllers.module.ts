import { Module } from '@nestjs/common';
import { ControllersController } from './controllers.controller.js';
import { ControllersService } from './controllers.service.js';
import { UnifiModule } from '../unifi/unifi.module.js';

@Module({
  imports: [UnifiModule],
  controllers: [ControllersController],
  providers: [ControllersService],
  exports: [ControllersService]
})
export class ControllersModule {}