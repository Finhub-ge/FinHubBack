import { Module } from '@nestjs/common';
import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LoanController],
  providers: [LoanService, JwtStrategy],
  exports: [LoanService]
})
export class LoanModule {}
