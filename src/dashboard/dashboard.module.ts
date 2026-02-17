import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LoanModule } from 'src/loan/loan.module';
import { CurrencyHelper } from 'src/helpers/currency.helper';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, CurrencyHelper],
  imports: [LoanModule, HttpModule],
  exports: [DashboardService],
})
export class DashboardModule { }
