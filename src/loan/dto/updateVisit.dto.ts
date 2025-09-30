import { IsNotEmpty, IsString, IsEnum, MinLength, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoanVisit_status } from "@prisma/client";

export class UpdateVisitDto {
  @ApiProperty({
    description: 'Status of the visit',
    enum: LoanVisit_status,
    required: false
  })
  @IsEnum(LoanVisit_status)
  @IsOptional()
  status?: LoanVisit_status;

  @ApiProperty({
    description: 'Comment about the visit (minimum 10 characters)',
    minLength: 10,
    required: false
  })
  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Comment must be at least 10 characters long' })
  comment?: string;
}
