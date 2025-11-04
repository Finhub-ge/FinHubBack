import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


dayjs.extend(utc);
dayjs.extend(timezone);


export class CreateTaskResponseDto {
  @ApiProperty({
    description: 'Task status ID',
    required: true,
    type: Number
  })
  @IsNotEmpty()
  @IsNumber()
  taskStatusId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response: string;

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
  @IsOptional()
  deadline?: string;
}