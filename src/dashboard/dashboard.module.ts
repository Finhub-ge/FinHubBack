import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LoanModule } from 'src/loan/loan.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [LoanModule],
  exports: [DashboardService],
})
export class DashboardModule { }
