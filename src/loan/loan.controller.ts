import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { LoanService } from './loan.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/enums/role.enum';
import { ApiBearerAuth, ApiConsumes, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateContactDto } from './dto/createContact.dto';
import { GetUser } from 'src/auth/decorator/get-user.decorator';
import { User } from '@prisma/client';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';
import { AddCommentDto } from './dto/addComment.dto';
import { AddDebtorStatusDto } from './dto/addDebtorStatus.dto';
import { UpdateLoanStatusDto } from './dto/updateLoanStatus.dto';
import { SendSmsDto } from './dto/sendSms.dto';
import { AssignLoanDto } from './dto/assignLoan.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateCommitteeDto } from './dto/createCommittee.dto';


@ApiTags('Loans')
@ApiBearerAuth('access-token')
@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get()
  getAll() {
    return this.loanService.getAll();
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':publicId')
  getOne(@Param('publicId') publicId: ParseUUIDPipe) {
    return this.loanService.getOne(publicId);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':publicId/debtor/contacts')
  addDebtorContact(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() createContactDto: CreateContactDto
  ) {
    return this.loanService.addDebtorContact(publicId, createContactDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('/:publicId/loan-attributes')
  addLoanAttributes(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addLoanAttributesDto: AddLoanAttributesDto
  ) {
    return this.loanService.addLoanAttributes(publicId, addLoanAttributesDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('/:publicId/comment')
  addComment(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addCommentDto: AddCommentDto
  ) {
    return this.loanService.addComment(publicId, addCommentDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':publicId/debtor/status')
  updateDeptorStatus(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addDebtorStatusDto: AddDebtorStatusDto
  ) {
    return this.loanService.updateDeptorStatus(publicId, addDebtorStatusDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':publicId/status')
  updateLoanStatus(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() updateLoanStatusDto: UpdateLoanStatusDto
  ) {
    return this.loanService.updateLoanStatus(publicId, updateLoanStatusDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':publicId/sendSms')
  async sendSms(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() sendSmsDto: SendSmsDto
  ) {
    return await this.loanService.sendSms(publicId, sendSmsDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':publicId/assignment')
  assignLoan(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() sssignLoanDto: AssignLoanDto
  ) {
    return this.loanService.assignLoanToUser(publicId, sssignLoanDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.COLLECTOR, Role.SUPER_ADMIN)
  @Post('/:publicId/committee')
  @UseInterceptors(FileInterceptor('attachment'))
  requestCommittee(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() createCommitteeDto: CreateCommitteeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.loanService.requestCommittee(publicId, createCommitteeDto, user.id, file);
  }
}