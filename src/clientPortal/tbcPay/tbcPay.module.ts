import { Module } from "@nestjs/common";
import { TbcPayController } from "./tbcPay.controller";
import { TbcPayService } from "./tbcPay.service";
import { JsonResponseHelper } from "./helpers/jsonResponse.helper";

@Module({
  // imports: [ConfigModule, AminModule],
  controllers: [TbcPayController],
  providers: [TbcPayService, JsonResponseHelper], //TbcPayWhitelistGuard, ],
  exports: [TbcPayService],
})
export class TbcPayModule { }