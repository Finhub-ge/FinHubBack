import { IsNotEmpty, IsString, IsEnum, MinLength, IsDate } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoanVisit_status } from "@prisma/client";

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


  @ApiProperty({
    description: 'Scheduled date of the visit',
    type: Date
  })
  @IsDate()
  @IsNotEmpty()
  scheduledAt: Date;
}
