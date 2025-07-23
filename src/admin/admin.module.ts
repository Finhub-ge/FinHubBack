import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller";
import { JwtStrategy } from "src/auth/strategy/jwt.strategy";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy],
  exports: [AdminService]
})
export class AminModule {}