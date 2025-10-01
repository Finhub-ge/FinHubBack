import { IsNotEmpty, IsString, IsEnum, MinLength, IsDate, IsDateString, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoanVisit_status } from "@prisma/client";
import { Transform } from "class-transformer";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);

export class AddVisitDto {
  @ApiProperty({
    description: 'Status of the visit',
    enum: LoanVisit_status,
  })
  @IsEnum(LoanVisit_status)
  @IsNotEmpty()
  status: LoanVisit_status;

  @ApiProperty({
    description: 'Comment about the visit (minimum 10 characters)',
    minLength: 10
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Comment must be at least 10 characters long' })
  comment: string;


  // @ApiProperty({
  //   description: 'Scheduled date of the visit',
  //   type: Date
  // })
  // @Transform(({ value }) => {
  //   // Convert UTC ISO string to Tbilisi local date string (YYYY-MM-DD)
  //   console.log(value)
  //   const date = dayjs
  //     .utc(value)
  //     .tz('Asia/Tbilisi')
  //     .hour(12)
  //     .minute(0)
  //     .second(0)
  //     .utc()
  //     .toISOString()

  //   console.log(date, 'data')
  //   return date;
  // })
  // @IsDateString()
  // @IsNotEmpty()
  // scheduledAt: string;

  @ApiProperty({
    description: 'ID of the address for the visit',
  })
  @IsNumber()
  @IsNotEmpty()
  addressId: number;
}
