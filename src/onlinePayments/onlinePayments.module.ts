import { Module } from '@nestjs/common';
import { TbcPayModule } from './providers/tbcPay/tbcPay.module';

/**
 * Main module for all online payment providers
 * Includes: TBC Pay, BOG Pay (future), etc.
 *
 * Note: Common service is used directly by each provider, no separate module needed
 */
@Module({
  imports: [
    TbcPayModule,
    // Future payment providers (BOG, etc.) will be added here
  ],
  exports: [TbcPayModule],
})
export class OnlinePaymentsModule {}
