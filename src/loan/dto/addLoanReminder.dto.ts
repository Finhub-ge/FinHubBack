import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export class AddLoanReminderDto {
  @ApiProperty({
    description: 'Deadline date for the reminder',
    type: String,
    format: 'date-time'
  })
  @Transform(({ value }) => {
    const date = dayjs
      .utc(value)
      .tz('Asia/Tbilisi')
      .hour(12)
      .minute(0)
      .second(0)
      .utc()
      .toISOString();
    return date;
  })
  @IsDateString()
  @IsNotEmpty()
  deadLine: string;

  @ApiProperty({
    description: 'Comment for the reminder',
    required: false
  })
  @IsString()
  @IsOptional()
  comment?: string;
}

