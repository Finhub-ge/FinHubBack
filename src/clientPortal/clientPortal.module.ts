import { Module } from "@nestjs/common";
import { ClientAuthModule } from "./clientAuth/clientAuth.module";
import { TbcPayModule } from "./tbcPay/tbcPay.module";

@Module({
  imports: [ClientAuthModule, TbcPayModule],
  exports: [ClientAuthModule, TbcPayModule],
})
export class ClientPortalModule { }