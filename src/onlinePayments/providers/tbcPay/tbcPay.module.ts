import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TbcPayController } from './tbcPay.controller';
import { TbcPayService } from './tbcPay.service';
import { TbcPayWhitelistGuard } from './guards/tbcpay-whitelist.guard';
import { XmlResponseHelper } from './helpers/xml-response.helper';
import { AdminModule } from 'src/admin/admin.module';
import { OnlinePaymentCommonService } from '../../common/services/online-payment-common.service';

@Module({
  imports: [ConfigModule, AdminModule],
  controllers: [TbcPayController],
  providers: [
    TbcPayService,
    TbcPayWhitelistGuard,
    XmlResponseHelper,
    OnlinePaymentCommonService, // Common service used directly
  ],
  exports: [TbcPayService],
})
export class TbcPayModule { }
