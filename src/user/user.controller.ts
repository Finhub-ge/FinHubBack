import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { RolesGuard } from "src/auth/guard/roles.guard";
import { Role } from "src/enums/role.enum";
import { Roles } from "src/auth/decorator/role.decorator";

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService
  ) {}

  @UseGuards( JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('create')
  createUser(@Body() data: CreateUserDto) {
    return this.userService.createUser(data)
  }

  @UseGuards( JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('byRole')
  getUsersGroupedByRole() {
    return this.userService.getUsersGroupedByRole()
  }

  @UseGuards( JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':roleId')
  getUsersByRoleId(@Param('roleId') roleId: string) {
    return this.userService.getUsersByRoleId(roleId)
  }
}