import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AuthDto } from "./dto/auth.dto";
import { Public } from "./decorator/public.decorator";
import { Roles } from "./decorator/role.decorator";
import { Role } from "src/enums/role.enum";
import { RolesGuard } from "./guard/roles.guard";
import { JwtGuard } from "./guard/jwt.guard";
import { SignUpSuperAdminDto } from "./dto/signupSuperAdmin.dto";
import { UserSigninDto } from "./dto/userSignin.dto";
import { SetNewPwdDto } from "./dto/setNewPwd.dto";
import { GetUser } from "./decorator/get-user.decorator";
import { User } from "@prisma/client";

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public() // secure later with a setup token or IP restriction.
  @Post('signupSuperAdmin')
  signupSuperAdmin(@Body() dto: SignUpSuperAdminDto) {
    return this.authService.signupSuperAdmin(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signinSuperAdmin')
  signinAdmin(@Body() dto: AuthDto) {
    return this.authService.signinSuperAdmin(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signin(@Body() dto: UserSigninDto) {
    return this.authService.signinUser(dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COLLECTOR, Role.COURIER, Role.ACCOUNTANT, Role.LAWYER)
  @Post('changePwd')
  changePwd(@GetUser() user: User, @Body() dto: SetNewPwdDto) {
    return this.authService.changePwd(user, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('roles')
  getRoles() {
    return this.authService.getRoles()
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.COLLECTOR,
    Role.COURIER,
    Role.ACCOUNTANT,
    Role.LAWYER,
    Role.JUNIOR_LAWYER,
    Role.SUPER_LAWYER, Role.AML_OFFICER, Role.ANALYTICS, Role.HR, Role.GENERAL_MANAGER, Role.PERSONAL_DATA_PROTECTION_OFFICER, Role.CONTROLLER, Role.ANALYST, Role.OPERATIONAL_MANAGER)
  @Get('me')
  getCurrentUser(@GetUser() user: User) {
    return this.authService.getCurrentUser(user)
  }
}