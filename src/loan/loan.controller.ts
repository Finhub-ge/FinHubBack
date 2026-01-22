import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res, SetMetadata, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { LoanService } from './loan.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { AllRoles, ExceptRoles, Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/enums/role.enum';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateContactDto } from './dto/createContact.dto';
import { GetUser } from 'src/auth/decorator/get-user.decorator';
import { StatusMatrix_entityType, User } from '@prisma/client';
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
import { AddAddressDto } from './dto/addAddress.dto';
import { UpdateAddressDto } from './dto/updateAddress.dto';
import { AddVisitDto } from './dto/addVisit.dto';
import { UpdateVisitDto } from './dto/updateVisit.dto';
import { GetLoansFilterDto, GetLoansFilterWithPaginationDto } from './dto/getLoansFilter.dto';
import { UpdatePortfolioGroupDto } from './dto/updatePortfolioGroup.dto';
import { AddLoanReminderDto } from './dto/addLoanReminder.dto';
import { UpdateCommentDto } from './dto/updateComment.dto';
import { Response } from 'express';

@ApiTags('Loans')
@ApiBearerAuth('access-token')
@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) { }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get()
  getAll(@GetUser() user: User, @Query() filterDto: GetLoansFilterWithPaginationDto) {
    return this.loanService.getAll(filterDto, user);
  }

  // @UseGuards(JwtGuard, RolesGuard)
  // @AllRoles()
  // @Get('exportExcel')
  // // @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  // async exportLoans(@GetUser() user: User, @Query() filterDto: GetLoansFilterDto) {
  //   const excelBuffer = await this.loanService.exportLoans(filterDto, user);

  //   return new StreamableFile(Buffer.from(excelBuffer), {
  //     type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //     disposition: `attachment; filename=Cases_list_${Date.now()}.xlsx`
  //   });
  // }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('exportExcel')
  async exportLoans(
    @GetUser() user: User,
    @Query() filterDto: GetLoansFilterDto,
    @Res({ passthrough: true }) res: Response
  ) {
    // Set longer timeout for large exports
    res.setTimeout(600000); // 10 minutes

    const excelBuffer = await this.loanService.exportLoans(filterDto, user);

    return new StreamableFile(Buffer.from(excelBuffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=Cases_list_${Date.now()}.xlsx`
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get('summary')
  getSummary(@Query() filterDto: GetLoansFilterDto, @GetUser() user: User) {
    return this.loanService.getSummary(filterDto, user);
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
  @AllRoles()
  @Get(':publicId/export/payments')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportPayments(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe,) {
    const excelBuffer = await this.loanService.exportPayments(publicId, user);

    return new StreamableFile(Buffer.from(excelBuffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=Case_payments_${Date.now()}.xlsx`
    });
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':publicId/export/previous-payments')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportPreviousPayments(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe,) {
    const excelBuffer = await this.loanService.exportPreviousPayments(publicId, user);

    return new StreamableFile(Buffer.from(excelBuffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=Case_previous_payments_${Date.now()}.xlsx`
    });
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.ANALYST)
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

  // @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  // @ApiParam({ name: 'contactId', type: 'string', format: 'int' })
  // @UseGuards(JwtGuard, RolesGuard)
  // @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  // @Delete(':publicId/debtor/contacts/:contactId')
  // deleteDebtorContact(
  //   @GetUser() user: User,
  //   @Param('publicId', ParseUUIDPipe) publicId: string,
  //   @Param('contactId', ParseIntPipe) contactId: number
  // ) {
  //   return this.loanService.deleteDebtorContact(publicId, contactId, user.id);
  // }

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
    return this.loanService.addComment(publicId, addCommentDto, user, file);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Post(':publicId/lawyer-comment')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.LAWYER, Role.JUNIOR_LAWYER, Role.EXECUTION_LAWYER, Role.OPERATIONAL_MANAGER, Role.SUPER_LAWYER)
  addLawyerComment(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() addCommentDto: AddCommentDto
  ) {
    return this.loanService.addComment(publicId, addCommentDto, user);
  }

  @ApiParam({ name: 'commentId', type: 'number' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Patch('comment/:commentId')
  updateComment(
    @GetUser() user: User,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() updateCommentDto: UpdateCommentDto
  ) {
    return this.loanService.updateComment(commentId, updateCommentDto, user.id);
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
    return this.loanService.updateLoanStatus(publicId, updateLoanStatusDto, user);
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
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST, Role.COLLECTOR)
  @Post(':publicId/assignment')
  async assignLoan(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() sssignLoanDto: AssignLoanDto
  ) {
    return this.loanService.assignLoanToUser(publicId, sssignLoanDto, user);
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
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':publicId/address')
  getAddress(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
  ) {
    return this.loanService.getAddress(publicId, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Post(':publicId/address')
  addAddress(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddAddressDto
  ) {
    return this.loanService.addAddress(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'addressId', type: 'number' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Patch(':publicId/address/:addressId')
  updateAddress(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body() data: UpdateAddressDto
  ) {
    return this.loanService.updateAddress(publicId, addressId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'addressId', type: 'number' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Delete(':publicId/address/:addressId')
  deleteAddress(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Param('addressId', ParseIntPipe) addressId: number
  ) {
    return this.loanService.deleteAddress(publicId, addressId, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COLLECTOR, Role.OPERATIONAL_MANAGER)
  @Post(':publicId/visit')
  addVisit(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddVisitDto
  ) {
    return this.loanService.addVisit(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'visitId', type: 'number' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COLLECTOR, Role.OPERATIONAL_MANAGER)
  @Patch(':publicId/visit/:visitId')
  updateVisit(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() data: UpdateVisitDto
  ) {
    return this.loanService.updateVisit(publicId, visitId, data, user.id);
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

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'entityType',
    enum: StatusMatrix_entityType,
  })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COLLECTOR, Role.OPERATIONAL_MANAGER)
  @Get(':publicId/availableStatuses')
  async getAvailableStatuses(@Param('publicId') publicId: ParseUUIDPipe, @Query('entityType') entityType: StatusMatrix_entityType,) {
    return this.loanService.getAvailableStatuses(publicId, entityType);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATIONAL_MANAGER, Role.OPERATIONAL_DIRECTOR)
  @Patch(':publicId/updatePortfolioGroup')
  async updatePortfolioGroup(@GetUser() user: User, @Param('publicId') publicId: ParseUUIDPipe, @Body() updatePortfolioGroupDto: UpdatePortfolioGroupDto) {
    return this.loanService.updatePortfolioGroup(publicId, user.id, updatePortfolioGroupDto);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @ExceptRoles(Role.CONTROLLER, Role.ANALYST)
  @Post(':publicId/loanReminder')
  addLoanReminder(
    @GetUser() user: User,
    @Param('publicId') publicId: ParseUUIDPipe,
    @Body() data: AddLoanReminderDto
  ) {
    return this.loanService.addLoanReminder(publicId, data, user.id);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':publicId/availableLitigationStatuses')
  async getAvailableLitigationStatuses(@Param('publicId') publicId: ParseUUIDPipe) {
    return this.loanService.getAvailableLitigationStatuses(publicId);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Get(':publicId/availableLegalStatuses')
  async getAvailableLegalStatuses(@Param('publicId') publicId: ParseUUIDPipe) {
    return this.loanService.getAvailableLegalStatuses(publicId);
  }

  @ApiParam({ name: 'publicId', type: 'string', format: 'uuid' })
  @UseGuards(JwtGuard, RolesGuard)
  @AllRoles()
  @Post(':publicId/request-lawyer')
  async requestLawyer(
    @Param('publicId') publicId: ParseUUIDPipe,
    @GetUser() user: User
  ) {
    return this.loanService.requestLawyer(publicId, user.id);
  }
}