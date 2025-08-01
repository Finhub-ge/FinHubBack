import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class AgreementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstPaymentDate: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  agreedAmount: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  numberOfMonths: number;
}

class PromiseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentDate: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  agreedAmount: number;
}

export class UpdateLoanStatusDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  statusId: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => AgreementDto)
  agreement?: AgreementDto;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => PromiseDto)
  promise?: PromiseDto;
}