import { Body, Controller, Get, Param, ParseUUIDPipe, ParseIntPipe, Post, Patch, UseGuards, Query, Delete } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { AllRoles, ExceptRoles, Roles } from "src/auth/decorator/role.decorator";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetUser } from "src/auth/decorator/get-user.decorator";
import { User } from "@prisma/client";
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
  @AllRoles()
  @Get('transactions/get')
  async getTransactionList(@Query() getPaymentDto: GetPaymentWithPaginationDto) {
    return await this.adminService.getTransactionList(getPaymentDto);
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

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT)
  @Post('addPayment/:publicId') // Loan publicId
  async addPayment(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe, @Body() data: CreatePaymentDto) {
    return await this.adminService.addPayment(publicId, data, user.id);
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
  async deleteTransaction(@Param('id') id: string) {
    return await this.adminService.deleteTransaction(+id);
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
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
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
  async getAllCommittees(@Query() getCommiteesDto: GetCommiteesWithPaginationDto) {
    return await this.adminService.getAllCommittees(getCommiteesDto);
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
  async getLoanMarks(@Query() getMarkReportDto: GetMarkReportWithPaginationDto) {
    return await this.adminService.getLoanMarks(getMarkReportDto);
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
  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @Post('addCharge/:publicId')
  async addCharge(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe, @Body() data: CreateChargeDto) {
    return await this.adminService.addCharge(publicId, data, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
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
  @AllRoles()
  @Get('file/:id')
  async downloadFile(@Param('id') id: number) {
    return await this.adminService.downloadFile(id)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('createTeam')
  async createTeam(
    @GetUser() user: User,
    @Body() data: CreateTeamDto
  ) {
    return await this.adminService.createTeam(data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('getTeams')
  async getTeams() {
    return await this.adminService.getTeams();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiParam({ name: 'teamId', type: 'number' })
  @Patch('updateTeam/:teamId')
  async updateTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() data: UpdateTeamDto
  ) {
    return await this.adminService.updateTeam(teamId, data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiParam({ name: 'teamId', type: 'number' })
  @Delete('deleteTeam/:teamId')
  async deleteTeam(@Param('teamId', ParseIntPipe) teamId: number) {
    return await this.adminService.deleteTeam(teamId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
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
}