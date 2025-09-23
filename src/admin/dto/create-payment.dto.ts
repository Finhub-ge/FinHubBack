import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumberString, IsOptional, IsString, Max } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { ApiProperty } from '@nestjs/swagger';
import { IsNotFutureDate } from 'src/validators/date.validator';


dayjs.extend(utc);
dayjs.extend(timezone);

export class CreatePaymentDto {
  @ApiProperty()
  @IsNotEmpty()
  caseId: number;

  @ApiProperty()
  @IsNotEmpty()
  channel: number;

  @ApiProperty()
  @IsString()
  accountNumber: string;

  @ApiProperty()
  @IsNotEmpty()
  accountId: number;

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

    console.log(date)
    return date;
  })
  @ApiProperty()
  @IsDateString()
  @IsNotFutureDate({ message: 'Payment date cannot be in the future' })
  paymentDate: string;

  @ApiProperty()
  @IsNumberString()
  amount: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  comment?: string;
}