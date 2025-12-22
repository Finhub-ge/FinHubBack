import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AllRoles, Roles } from 'src/auth/decorator/role.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetPlanReportDto, GetPlanReportWithPaginationDto } from './dto/getPlanReport.dto';
import { Role } from 'src/enums/role.enum';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @Get('planChart')
  getPlanChart(@Query() getPlanChartDto: GetPlanReportDto) {
    return this.dashboardService.getPlanChart(getPlanChartDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @Get('planReport')
  getPlanReport(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReport(getPlanReportDto);
  }

  // TODO: remove this function
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('planReportTest')
  getPlanReportTest(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReportV1(getPlanReportDto);
  }

  // TODO: remove this function
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('planReportData')
  getPlanReportData(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReportV2(getPlanReportDto);
  }
}
