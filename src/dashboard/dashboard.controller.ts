import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AllRoles } from 'src/auth/decorator/role.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetPlanChartDto } from './dto/getPlanChart.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('planChart')
  getPlanChart(@Query() getPlanChartDto: GetPlanChartDto) {
    return this.dashboardService.getPlanChart(getPlanChartDto);
  }
}
