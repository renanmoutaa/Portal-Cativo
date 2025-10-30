import { Module } from '@nestjs/common';
import { UnifiService } from './unifi.service.js';

@Module({
  providers: [UnifiService],
  exports: [UnifiService]
})
export class UnifiModule {}