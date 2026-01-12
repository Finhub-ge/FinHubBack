import { Module } from "@nestjs/common";
import { ClientAuthController } from "./clientAuth.controller";
import { ClientAuthService } from "./clientAuth.service";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientJwtStrategy } from "./strategies/clientJwt.strategy";
import { UtilsHelper } from "src/helpers/utils.helper";

@Module({
  imports: [
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '600m' },
      }),
    }),
  ],
  controllers: [ClientAuthController],
  providers: [ClientAuthService, ClientJwtStrategy, UtilsHelper],
  exports: [ClientAuthService],
})
export class ClientAuthModule { }