import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { IsWithinOneMonth } from 'src/validators/date.validator';

dayjs.extend(utc);
dayjs.extend(timezone);

export class PaymentScheduleItemDto {
  @ApiProperty()
  @Transform(({ value }) => {
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
  @Transform(({ value }) => Number(value)) // Convert to number
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;
}

class AgreementDto {
  @ApiProperty()
  @Transform(({ value }) => {
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
  firstPaymentDate: string;

  @ApiProperty()
  @Transform(({ value }) => Number(value)) // Convert to number
  @IsNumber()
  @IsNotEmpty()
  agreedAmount: number;

  @ApiProperty()
  @Transform(({ value }) => Number(value)) // Convert to number
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  numberOfMonths: number;

  @ApiProperty({ type: [PaymentScheduleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentScheduleItemDto)
  @ArrayMinSize(1)
  schedule: PaymentScheduleItemDto[];
}

class PromiseDto {
  @ApiProperty()
  @Transform(({ value }) => {
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
  @IsWithinOneMonth({ message: 'Payment date must be within one month from today' })
  paymentDate: string;

  @ApiProperty()
  @Transform(({ value }) => Number(value)) // Convert to number
  @IsNumber()
  @IsNotEmpty()
  agreedAmount: number;
}

export class UpdateLoanStatusDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  statusId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgreementDto)
  agreement?: AgreementDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromiseDto)
  promise?: PromiseDto;
}