import { Controller, Get, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/enums/role.enum';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @UseGuards( JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get()
  getAll() {
    return this.portfolioService.getAll();
  }
}
//for deployment test