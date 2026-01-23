import { Module } from "@nestjs/common";
import { ClientAuthModule } from "./clientAuth/clientAuth.module";

@Module({
  imports: [ClientAuthModule],
  exports: [ClientAuthModule],
})
export class ClientPortalModule { }