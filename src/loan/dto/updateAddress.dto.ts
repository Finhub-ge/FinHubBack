import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoanAddress_type } from "@prisma/client";

export class UpdateAddressDto {
  @ApiProperty({
    description: 'ID of the city',
    required: false
  })
  @IsNumber()
  @IsOptional()
  cityId?: number;

  @ApiProperty({
    description: 'Type of the address',
    enum: LoanAddress_type,
    required: false
  })
  @IsEnum(LoanAddress_type)
  @IsOptional()
  type?: LoanAddress_type;

  @ApiProperty({
    description: 'Address details',
    required: false
  })
  @IsString()
  @IsOptional()
  address?: string;
}
