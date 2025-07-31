import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

export class UpdatePaymentDto {
  @IsNotEmpty()
  caseId: number;

  @IsNotEmpty()
  channel: number;

  @IsString()
  accountNumber: string;

  @IsNotEmpty()
  accountId: number;

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
  @IsDateString()
  paymentDate: string;

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  publicId: string;
}