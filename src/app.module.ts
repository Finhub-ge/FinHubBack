import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LoanModule } from './loan/loan.module';
import { AppController } from './app.controller';
import { AdminModule } from './admin/admin.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron/cron.service';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ClientPortalModule } from './clientPortal/clientPortal.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    AuthModule,
    UserModule,
    LoanModule,
    AdminModule,
    DashboardModule,
    ClientPortalModule,
  ],
  controllers: [AppController],
  providers: [CronService],
})
export class AppModule { }
