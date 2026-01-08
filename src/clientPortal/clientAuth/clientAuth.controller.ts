import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ClientSigninDto } from "./dto/clientSignin.dto";
import { ClientAuthService } from "./clientAuth.service";
import { VerifyOtpDto } from "./dto/verifyOtp.dto";
import { ClientJwtGuard } from "./guards/clientJwt.guard";
import { GetClient } from "./decorator/getClient.decorator";
import { Debtor } from "@prisma/client";


@ApiTags('ClientAuth')
@Controller('clientAuth')
export class ClientAuthController {
  constructor(private readonly clientAuthService: ClientAuthService) { }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signin(@Body() dto: ClientSigninDto) {
    return this.clientAuthService.signin(dto);
  }

  @Post('verifyOtp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.clientAuthService.verifyOtp(verifyOtpDto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(ClientJwtGuard)
  @Get('me')
  getCurrentUser(@GetClient() user: Debtor) {
    return this.clientAuthService.getCurrentUser(user)
  }
}