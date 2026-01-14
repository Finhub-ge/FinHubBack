import { Body, Controller, Get, Param, ParseUUIDPipe, ParseIntPipe, Post, Patch, UseGuards, Query, Delete, UseInterceptors, UploadedFile, Header, StreamableFile } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ApiBearerAuth, ApiConsumes, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { AllRoles, ExceptRoles, Roles } from "src/auth/decorator/role.decorator";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetUser } from "src/auth/decorator/get-user.decorator";
import { StatusMatrix_entityType, User } from "@prisma/client";
import { CreateTaskDto } from "./dto/createTask.dto";
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksWithPaginationDto } from "./dto/getTasksFilter.dto";
import { ResponseCommitteeDto } from "./dto/responseCommittee.dto";
import { CreateMarksDto } from "./dto/createMarks.dto";
import { CreateChargeDto } from "./dto/create-charge.dto";
import { CreateTeamDto } from "./dto/createTeam.dto";
import { UpdateTeamDto } from "./dto/updateTeam.dto";
import { ManageTeamUsersDto } from "./dto/manageTeamUsers.dto";
import { GetPaymentDto, GetPaymentWithPaginationDto } from "./dto/getPayment.dto";
import { GetChargeWithPaginationDto } from "./dto/getCharge.dto";
import { GetMarkReportWithPaginationDto } from "./dto/getMarkReport.dto";
import { GetCommiteesWithPaginationDto } from "./dto/getCommitees.dto";
import { GetPaymentReportDto, GetPaymentReportWithPaginationDto } from "./dto/getPaymentReport.dto";
import { GetChargeReportWithPaginationDto } from "./dto/getChargeReport.dto";
import { GetFuturePaymentsWithPaginationDto } from "./dto/getFuturePayments.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadPlanDto } from "src/admin/dto/uploadPlan.dto";

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) { }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('debtor-contact-types')
  getDebtorContactTypes() {
    return this.adminService.getDebtorContactTypes();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('debtor-contact-labels')
  getDebtorContactLabels() {
    return this.adminService.getDebtorContactLabels();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('attributes')
  getAttributes() {
    return this.adminService.getAttributes();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('debtor-statuses')
  getDebtorStatuses() {
    return this.adminService.getDebtoreStatuses();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.OPERATIONAL_MANAGER, Role.OPERATIONAL_DIRECTOR, Role.COLLECTOR)
  @Get('transactions/get')
  async getTransactionList(@GetUser() user: User, @Query() getPaymentDto: GetPaymentWithPaginationDto) {
    return await this.adminService.getTransactionList(getPaymentDto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('loan-statuses')
  getloanStatuses() {
    return this.adminService.getloanStatuses();
  }

  @UseGuards(JwtGuard)
  @Get('tasks')
  getTasks(@GetUser() user: User, @Query() getTasksFilterDto: GetTasksWithPaginationDto) {
    return this.adminService.getTasks(user, getTasksFilterDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT)
  @Post('addPayment') // Loan publicId
  async addPayment(@GetUser() user: User, @Body() data: CreatePaymentDto) {
    return await this.adminService.addPayment(data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT)
  @Post('updatePayment/:publicId') // Transaction publicId
  async updatePayment(@Param('publicId') publicId: ParseUUIDPipe, @Body() data: UpdatePaymentDto) {
    return await this.adminService.updatePayment(publicId, data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT)
  @Post('deleteTransaction/:id')
  async deleteTransaction(@Param('id') id: string, @GetUser() user: User) {
    return await this.adminService.deleteTransaction(+id, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Post('createTask')
  async createTask(@GetUser() user: User, @Body() data: CreateTaskDto) {
    return await this.adminService.createTask(data, user.id);
  }

  @UseGuards(JwtGuard)
  @Post('taskResponse/:id')
  async createTaskResponse(
    @GetUser() user: User,
    @Body() data: CreateTaskResponseDto,
    @Param('id') id: number
  ) {
    return await this.adminService.createTaskResponse(id, data, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CONTROLLER, Role.OPERATIONAL_MANAGER)
  @Post('committee/:id/response')
  async responseCommittee(
    @GetUser() user: User,
    @Body() data: ResponseCommitteeDto,
    @Param('id') id: number
  ) {
    return await this.adminService.responseCommittee(id, data, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('committees')
  async getAllCommittees(@GetUser() user: User, @Query() getCommiteesDto: GetCommiteesWithPaginationDto) {
    return await this.adminService.getAllCommittees(getCommiteesDto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post('createMarks')
  async createMarks(
    @GetUser() user: User,
    @Body() data: CreateMarksDto
  ) {
    return await this.adminService.createMarks(data.title);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post('updateMarks/:id')
  async updateMarks(
    @GetUser() user: User,
    @Body() data: CreateMarksDto,
    @Param('id') id: number
  ) {
    return await this.adminService.updateMarks(id, data.title);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Delete('deleteMarks/:id')
  async deleteMarks(@Param('id') id: number) {
    return await this.adminService.deleteMarks(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('marks')
  async getMarks() {
    return await this.adminService.getMarks();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('loanMarks')
  async getLoanMarks(@GetUser() user: User, @Query() getMarkReportDto: GetMarkReportWithPaginationDto) {
    return await this.adminService.getLoanMarks(getMarkReportDto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('legalStages')
  async getLegalStages() {
    return await this.adminService.getLegalStages();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('collateralStatuses')
  async getCollateralStatuses() {
    return await this.adminService.getCollateralStatuses();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('litigationStages')
  async getLitigationStages() {
    return await this.adminService.getLitigationStages();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('chargeTypes')
  async getChargeTypes() {
    return await this.adminService.getChargeTypes();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post('addCharge')
  async addCharge(@GetUser() user: User, @Body() data: CreateChargeDto) {
    return await this.adminService.addCharge(data, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.OPERATIONAL_MANAGER)
  @Get('getCharges')
  async getCharges(@Query() getChargeDto: GetChargeWithPaginationDto) {
    return await this.adminService.getCharges(getChargeDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('portfolios')
  async getPortfolios() {
    return await this.adminService.getPortfolios();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('portfolioSellers')
  async getPortfolioSellers() {
    return await this.adminService.getPortfolioSellers();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.OPERATIONAL_MANAGER)
  @Get('file/:id')
  async downloadFile(@Param('id') id: number) {
    return await this.adminService.downloadFile(id)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @Post('createTeam')
  async createTeam(
    @GetUser() user: User,
    @Body() data: CreateTeamDto
  ) {
    return await this.adminService.createTeam(data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @Get('getTeams')
  async getTeams() {
    return await this.adminService.getTeams();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @ApiParam({ name: 'teamId', type: 'number' })
  @Patch('updateTeam/:teamId')
  async updateTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() data: UpdateTeamDto
  ) {
    return await this.adminService.updateTeam(teamId, data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @ApiParam({ name: 'teamId', type: 'number' })
  @Delete('deleteTeam/:teamId')
  async deleteTeam(@Param('teamId', ParseIntPipe) teamId: number) {
    return await this.adminService.deleteTeam(teamId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER)
  @ApiParam({ name: 'teamId', type: 'number' })
  @Post('manageTeamUsers/:teamId')
  async manageTeamUsers(
    @GetUser() user: User,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() data: ManageTeamUsersDto
  ) {
    return await this.adminService.manageTeamUsers(teamId, data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('getCity')
  async getCity() {
    return await this.adminService.getCity();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('getVisitStatus')
  async getVisitStatus() {
    return await this.adminService.getVisitStatus();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('channelAccounts')
  async getChannelAccounts() {
    return await this.adminService.getChannelAccounts();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.OPERATIONAL_MANAGER, Role.OPERATIONAL_DIRECTOR, Role.COLLECTOR)
  @Get('report/payments')
  async getPaymentsReport(@GetUser() user: User, @Query() getPaymentReportDto: GetPaymentReportWithPaginationDto) {
    return await this.adminService.getTransactionList(getPaymentReportDto, user, { isReport: true });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.OPERATIONAL_MANAGER, Role.EXECUTION_LAWYER, Role.SUPER_LAWYER)
  @Get('report/charges')
  async getChargesReport(@Query() getChargeReportDto: GetChargeReportWithPaginationDto) {
    return await this.adminService.getCharges(getChargeReportDto, { isReport: true });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('taskStatuses')
  async getTaskStatuses() {
    return await this.adminService.getTaskStatuses();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':taskId/availableTaskStatuses')
  async getAvailableTaskStatuses(@Param('taskId') taskId: number, @Query('entityType') entityType: StatusMatrix_entityType,) {
    return await this.adminService.getAvailableTaskStatuses(taskId, entityType);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COLLECTOR, Role.OPERATIONAL_MANAGER)
  @Get('future-payments')
  async getFuturePayments(@GetUser() user: User, @Query() getFuturePaymentsDto: GetFuturePaymentsWithPaginationDto) {
    return await this.adminService.getFuturePayments(getFuturePaymentsDto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('plan/import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importPlan(
    @GetUser() user: User,
    @Body() data: UploadPlanDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.adminService.importPlan(file.buffer, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('getCurrency')
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format', example: '2024-12-25' })
  @ApiQuery({ name: 'currency', required: false, description: 'Currency code', example: 'USD', enum: ['USD', 'EUR', 'GBP'] })
  async getCurrency(
    @Query('date') date?: string,
    @Query('currency') currency?: string,
  ) {
    return await this.adminService.getCurrency(date, currency);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('paymentReport/exportExcel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportPaymentReport(@GetUser() user: User, @Query() getPaymentReportDto: GetPaymentReportDto) {
    const excelBuffer = await this.adminService.exportPaymentReport(getPaymentReportDto, user);
    return new StreamableFile(Buffer.from(excelBuffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=Payment_report_${Date.now()}.xlsx`
    });
  }
}