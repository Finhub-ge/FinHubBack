import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { LoanService } from './loan.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { AllRoles, ExceptRoles, Roles } from 'src/auth/decorator/role.decorator';
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
import { AddLoanMarksDto } from './dto/addLoanMarks.dto';
import { AddLoanLegalStageDto } from './dto/addLoanLegalStage.dto';
import { AddLoanCollateralStatusDto } from './dto/addLoanCollateralStatus.dto';
import { AddLoanLitigationStageDto } from './dto/addLoanLitigationStage.dto';
import { GetLoansFilterDto } from './dto/getLoansFilter.dto';


@ApiTags('Loans')
@ApiBearerAuth('access-token')
@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get()
  getAll(@Query() filters: GetLoansFilterDto) {
    return this.loanService.getAll(filters);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':publicId')
  getOne(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe) {
    return this.loanService.getOne(publicId, user);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/debtor/contacts')
  addDebtorContact(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() createContactDto: CreateContactDto
  ) {
    return this.loanService.addDebtorContact(publicId, createContactDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'contactId', type: 'string', format: 'int' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Patch(':publicId/debtor/contacts/:contactId')
  editDebtorContact(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() createContactDto: CreateContactDto
  ) {
    return this.loanService.editDebtorContact(publicId, contactId, createContactDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'contactId', type: 'string', format: 'int' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Delete(':publicId/debtor/contacts/:contactId')
  deleteDebtorContact(
    @GetUser() user: User,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('contactId', ParseIntPipe) contactId: number
  ) {
    return this.loanService.deleteDebtorContact(publicId, contactId, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post('/:publicId/loan-attributes')
  addLoanAttributes(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addLoanAttributesDto: AddLoanAttributesDto
  ) {
    return this.loanService.addLoanAttributes(publicId, addLoanAttributesDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Post('/:publicId/comment')
  @UseInterceptors(FileInterceptor('attachment'))
  addComment(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addCommentDto: AddCommentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.loanService.addComment(publicId, addCommentDto, user.id, file);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  addLawyerComment(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addCommentDto: AddCommentDto
  ) {
    return this.loanService.addComment(publicId, addCommentDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
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
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
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
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
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
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/assignment')
  async assignLoan(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() sssignLoanDto: AssignLoanDto
  ) {
    return this.loanService.assignLoanToUser(publicId, sssignLoanDto, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
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

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/loanMarks')
  addLoanMarks(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddLoanMarksDto
  ) {
    return this.loanService.addLoanMarks(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Delete(':publicId/loanMarks/:markId')
  deleteLoanMark(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Param('markId') markId: number
  ) {
    return this.loanService.deleteLoanMark(publicId, markId, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/loanLegalStage')
  addLoanLegalStage(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddLoanLegalStageDto
  ) {
    return this.loanService.addLoanLegalStage(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/loanCollateralStatus')
  addLoanCollateralStatus(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddLoanCollateralStatusDto
  ) {
    return this.loanService.addLoanCollateralStatus(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/loanLitigationStage')
  addLoanLitigationStage(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddLoanLitigationStageDto
  ) {
    return this.loanService.addLoanLitigationStage(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @AllRoles()
  @Get(':publicId/schedulePdf')
  async downloadSchedulePdf(@Param('publicId') publicId: ParseUUIDPipe,) {
    const { buffer, caseId } = await this.loanService.downloadSchedulePdfBuffer(publicId);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="schedule_${caseId}.pdf"`,
      length: buffer.length,
    });
  }
}