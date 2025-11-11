import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { EditUserDto } from "./dto/editUser.dto";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { AllRoles, Roles } from "src/auth/decorator/role.decorator";
import { GetUsersFilterDto, GetUsersWithPaginationDto } from "./dto/getUsersFilter.dto";
import { GetUser } from "src/auth/decorator/get-user.decorator";
import { User } from "@prisma/client";

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService
  ) { }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('create')
  createUser(@Body() data: CreateUserDto) {
    return this.userService.createUser(data)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('byRole')
  getUsersGroupedByRole() {
    return this.userService.getUsersGroupedByRole()
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('getAll')
  getAllUsers(@Query() getUsersFilterDto: GetUsersWithPaginationDto) {
    return this.userService.getAllUsers(getUsersFilterDto)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('exportExcel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportUsers(@Query() filterDto: GetUsersFilterDto) {
    const excelBuffer = await this.userService.exportUsers(filterDto);

    return new StreamableFile(Buffer.from(excelBuffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=Users_list_${Date.now()}.xlsx`
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':roleId')
  getUsersByRoleId(@Param('roleId') roleId: string) {
    return this.userService.getUsersByRoleId(roleId)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiParam({ name: 'userId', type: 'number' })
  @Patch(':userId')
  editUser(@Param('userId', ParseIntPipe) userId: number, @Body() data: EditUserDto) {
    return this.userService.editUser(userId, data)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('groupedBy/teamLeader')
  getUsersGroupedByTeamLeader(@Query() getUsersFilterDto: GetUsersFilterDto) {
    return this.userService.getUsersGroupedByTeamLeader(getUsersFilterDto)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('reminder/tasks')
  getTasks(@GetUser() user: User,) {
    return this.userService.getTasks(user)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('reminder/marks')
  getMarks(@GetUser() user: User) {
    return this.userService.getMarks(user)
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('reminder/reminders')
  getReminders(@GetUser() user: User) {
    return this.userService.getReminders(user, { type: 'reminders' })
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('reminder/payments')
  getPayments(@GetUser() user: User) {
    return this.userService.getReminders(user, { type: 'payments' })
  }
}