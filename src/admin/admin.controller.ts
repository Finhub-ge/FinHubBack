import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, Query, Delete } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { Roles } from "src/auth/decorator/role.decorator";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetUser } from "src/auth/decorator/get-user.decorator";
import { User } from "@prisma/client";
import { CreateTaskDto } from "./dto/createTask.dto";
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksFilterDto } from "./dto/getTasksFilter.dto";
import { ResponseCommitteeDto } from "./dto/responseCommittee.dto";
import { CreateMarksDto } from "./dto/createMarks.dto";

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) { }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtor-contact-types')
  getDebtorContactTypes() {
    return this.adminService.getDebtorContactTypes();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtor-contact-labels')
  getDebtorContactLabels() {
    return this.adminService.getDebtorContactLabels();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('attributes')
  getAttributes() {
    return this.adminService.getAttributes();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtor-statuses')
  getDebtorStatuses() {
    return this.adminService.getDebtoreStatuses();
  }

  @Get('transactions/get')
  async getTransactionList() {
    return await this.adminService.getTransactionList();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('loan-statuses')
  getloanStatuses() {
    return this.adminService.getloanStatuses();
  }

  @UseGuards(JwtGuard)
  @Get('tasks')
  getTasks(@GetUser() user: User, @Query() getTasksFilterDto: GetTasksFilterDto) {
    return this.adminService.getTasks(user, getTasksFilterDto);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @Post('addPayment/:publicId') // Loan publicId
  async addPayment(@Param('publicId') publicId: ParseUUIDPipe, @Body() data: CreatePaymentDto) {
    return await this.adminService.addPayment(publicId, data);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('updatePayment/:publicId') // Transaction publicId
  async updatePayment(@Param('publicId') publicId: ParseUUIDPipe, @Body() data: UpdatePaymentDto) {
    return await this.adminService.updatePayment(publicId, data);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('deleteTransaction/:id')
  async deleteTransaction(@Param('id') id: string) {
    return await this.adminService.deleteTransaction(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
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
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('committee/:id/response')
  async responseCommittee(
    @GetUser() user: User,
    @Body() data: ResponseCommitteeDto,
    @Param('id') id: number
  ) {
    return await this.adminService.responseCommittee(id, data, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('committees')
  async getAllCommittees() {
    return await this.adminService.getAllCommittees();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('createMarks')
  async createMarks(
    @GetUser() user: User,
    @Body() data: CreateMarksDto
  ) {
    return await this.adminService.createMarks(data.title);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('updateMarks/:id')
  async updateMarks(
    @GetUser() user: User,
    @Body() data: CreateMarksDto,
    @Param('id') id: number
  ) {
    return await this.adminService.updateMarks(id, data.title);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete('deleteMarks/:id')
  async deleteMarks(@Param('id') id: number) {
    return await this.adminService.deleteMarks(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('marks')
  async getMarks() {
    return await this.adminService.getMarks();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('loanMarks')
  async getLoanMarks() {
    return await this.adminService.getLoanMarks();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('legalStages')
  async getLegalStages() {
    return await this.adminService.getLegalStages();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('collateralStatuses')
  async getCollateralStatuses() {
    return await this.adminService.getCollateralStatuses();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('litigationStages')
  async getLitigationStages() {
    return await this.adminService.getLitigationStages();
  }
}