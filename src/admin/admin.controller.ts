import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { Roles } from "src/auth/decorator/role.decorator";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetUser } from "src/auth/decorator/get-user.decorator";
import { User } from "@prisma/client";
import { CreateTaskDto } from "./dto/createTask.dto";

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

  @Post('addPayment/:publicId') // Loan publicId
  async addPayment(@Param('publicId') publicId: ParseUUIDPipe, @Body() data: CreatePaymentDto) {
    return await this.adminService.addPayment(publicId, data);
  }

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
}