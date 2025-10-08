import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { EditUserDto } from "./dto/editUser.dto";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { Roles } from "src/auth/decorator/role.decorator";
import { GetUsersFilterDto } from "./dto/getUsersFilter.dto";
import { Public } from "src/auth/decorator/public.decorator";

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
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('getAll')
  getAllUsers(@Query() getUsersFilterDto: GetUsersFilterDto) {
    return this.userService.getAllUsers(getUsersFilterDto)
  }

  @Public()
  @Get('tempCreateUser')
  tempCreateUser() {
    return this.userService.tempCreateUser()
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
}