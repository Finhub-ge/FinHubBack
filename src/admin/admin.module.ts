import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller";
import { JwtStrategy } from "src/auth/strategy/jwt.strategy";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { S3Helper } from "src/helpers/s3.helper";
import { PermissionsHelper } from "src/helpers/permissions.helper";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy, PaymentsHelper, S3Helper, PermissionsHelper],
  exports: [AdminService]
})
export class AminModule { }