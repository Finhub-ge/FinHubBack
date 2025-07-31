import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

export class CreatePaymentDto {
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
    return dayjs.utc(value).tz('Asia/Tbilisi').format('YYYY-MM-DD');
  })
  @IsDateString() // still checks if input is a valid ISO date string
  paymentDate: string; // final value will be in 'YYYY-MM-DD'

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  comment?: string;

}