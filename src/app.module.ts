import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LoanModule } from './loan/loan.module';
import { AppController } from './app.controller';
import { AminModule } from './admin/admin.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    LoanModule,
    AminModule
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
