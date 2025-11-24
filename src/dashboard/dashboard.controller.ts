import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AllRoles } from 'src/auth/decorator/role.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetPlanReportDto, GetPlanReportWithPaginationDto } from './dto/getPlanReport.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('planChart')
  getPlanChart(@Query() getPlanChartDto: GetPlanReportDto) {
    return this.dashboardService.getPlanChart(getPlanChartDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('planReport')
  getPlanReport(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReport(getPlanReportDto);
  }

  // TODO: remove this function
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('planReportTest')
  getPlanReportTest(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReportV1(getPlanReportDto);
  }

  // TODO: remove this function
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('planReportData')
  getPlanReportData(@Query() getPlanReportDto: GetPlanReportWithPaginationDto) {
    return this.dashboardService.getPlanReportV2(getPlanReportDto);
  }
}
