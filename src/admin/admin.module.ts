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
import { LoanModule } from "src/loan/loan.module";
import { ScopeService } from "src/helpers/scope.helper";

@Module({
  imports: [JwtModule.register({}), HttpModule, LoanModule],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy, PaymentsHelper, S3Helper, PermissionsHelper, CurrencyHelper, ScopeService],
  exports: [AdminService]
})
export class AdminModule { }