import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
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
  @Get(':id/debtor')
  getLoanDebtor(@Param('id', ParseIntPipe) id: number) {
    return this.loanService.getLoanDebtor(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('debtors/:id/contacts')
  addDebtorContact(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number, 
    @Body() createContactDto: CreateContactDto
  ) {
    return this.loanService.addDebtorContact(id, createContactDto, user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('/:id/loan-attributes')
  addLoanAttributes(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number, 
    @Body() addLoanAttributesDto: AddLoanAttributesDto
  ) {
    return this.loanService.addLoanAttributes(id, addLoanAttributesDto, user.id);
  }
}