import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  
})
export class AuthModule {}