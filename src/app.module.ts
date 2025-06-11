import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      
    }),
    PrismaModule,
    AuthModule,
    UserModule
  ],
  controllers: [],
  providers: [ConfigModule],
})
export class AppModule {}
