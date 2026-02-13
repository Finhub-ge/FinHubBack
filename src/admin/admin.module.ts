import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller";
import { JwtStrategy } from "src/auth/strategy/jwt.strategy";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { S3Helper } from "src/helpers/s3.helper";
import { PermissionsHelper } from "src/helpers/permissions.helper";
import { CurrencyHelper } from "src/helpers/currency.helper";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [JwtModule.register({}), HttpModule],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy, PaymentsHelper, S3Helper, PermissionsHelper, CurrencyHelper],
  exports: [AdminService]
})
export class AdminModule { }