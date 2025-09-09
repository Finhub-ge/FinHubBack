import { Module } from '@nestjs/common';
import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import { UtilsHelper } from 'src/helpers/utils.helper';
import { HttpModule } from '@nestjs/axios';
import { S3Helper } from 'src/helpers/s3.helper';
import { PdfHelper } from 'src/helpers/pdf.helper';

@Module({
  imports: [JwtModule.register({}), HttpModule],
  controllers: [LoanController],
  providers: [LoanService, JwtStrategy, PaymentsHelper, UtilsHelper, S3Helper, PdfHelper],
  exports: [LoanService]
})
export class LoanModule { }
