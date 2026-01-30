import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsNumberString, IsOptional, IsString } from 'class-validator';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { ApiProperty } from '@nestjs/swagger';
import { IsNotFutureDate } from 'src/validators/date.validator';

dayjs.extend(utc);
dayjs.extend(timezone);

export class CreateChargeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  chargeTypeId: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  channel: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  accountId?: number;

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
  @IsDateString()
  @IsNotFutureDate({ message: 'Charge date cannot be in the future' })
  chargeDate: string;

  @ApiProperty()
  @IsNumberString()
  amount: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  comment?: string;
}
