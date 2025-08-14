import { Module } from '@nestjs/common';
import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import { UtilsHelper } from 'src/helpers/utils.helper';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LoanController],
  providers: [LoanService, JwtStrategy, PaymentsHelper, UtilsHelper],
  exports: [LoanService]
})
export class LoanModule { }
