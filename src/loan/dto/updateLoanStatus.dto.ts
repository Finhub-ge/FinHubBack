import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

class AgreementDto {
  @ApiProperty()
  @Transform(({ value }) => {
    // Convert UTC ISO string to Tbilisi local date string (YYYY-MM-DD)
    console.log(value)
    const date = dayjs
      .utc(value)
      .tz('Asia/Tbilisi')
      .hour(12)
      .minute(0)
      .second(0)
      .utc()
      .toISOString()

    console.log(date, 'data')
    return date;
  })
  @IsDateString()
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
  @ApiProperty()
  @Transform(({ value }) => {
    // Convert UTC ISO string to Tbilisi local date string (YYYY-MM-DD)
    const date = dayjs
      .utc(value)
      .tz('Asia/Tbilisi')
      .hour(12)
      .minute(0)
      .second(0)
      .utc()
      .toISOString()

    return date;
  })
  @IsDateString()
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