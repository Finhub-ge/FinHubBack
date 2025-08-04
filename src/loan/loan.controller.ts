import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { LoanService } from './loan.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/enums/role.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateContactDto } from './dto/createContact.dto';
import { GetUser } from 'src/auth/decorator/get-user.decorator';
import { User } from '@prisma/client';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';
import { AddCommentDto } from './dto/addComment.dto';
import { AddDebtorStatusDto } from './dto/addDebtorStatus.dto';
import { UpdateLoanStatusDto } from './dto/updateLoanStatus.dto';

@ApiTags('Loans')
@ApiBearerAuth('access-token')
@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get()
  getAll() {
    return this.loanService.getAll();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':publicId')
  getOne(@Param('publicId') publicId: string) {
    return this.loanService.getOne(publicId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':loanId/debtor/contacts')
  addDebtorContact(
    @GetUser() user: User,
    @Param('loanId', ParseIntPipe) loanId: number, 
    @Body() createContactDto: CreateContactDto
  ) {
    return this.loanService.addDebtorContact(loanId, createContactDto, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('/:loanId/loan-attributes')
  addLoanAttributes(
    @GetUser() user: User,
    @Param('loanId', ParseIntPipe) loanId: number, 
    @Body() addLoanAttributesDto: AddLoanAttributesDto
  ) {
    return this.loanService.addLoanAttributes(loanId, addLoanAttributesDto, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('/:loanId/comment')
  addComment(
    @GetUser() user: User,
    @Param('loanId', ParseIntPipe) loanId: number, 
    @Body() addCommentDto: AddCommentDto
  ) {
    return this.loanService.addComment(loanId, addCommentDto, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':loanId/debtor/status')
  updateDeptorStatus(
    @GetUser() user: User,
    @Param('loanId', ParseIntPipe) loanId: number, 
    @Body() addDebtorStatusDto: AddDebtorStatusDto
  ) {
    return this.loanService.updateDeptorStatus(loanId, addDebtorStatusDto, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':loanId/status')
  updateLoanStatus(
    @GetUser() user: User,
    @Param('loanId', ParseIntPipe) loanId: number, 
    @Body() updateLoanStatusDto: UpdateLoanStatusDto
  ) {
    return this.loanService.updateLoanStatus(loanId, updateLoanStatusDto, user.id);
  }
}