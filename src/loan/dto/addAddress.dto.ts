import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoanAddress_type } from "@prisma/client";

export class AddAddressDto {
  @ApiProperty({
    description: 'ID of the city',
  })
  @IsNumber()
  @IsNotEmpty()
  cityId: number;

  @ApiProperty({
    description: 'Type of the address',
    enum: LoanAddress_type,
    example: LoanAddress_type.registered
  })
  @IsEnum(LoanAddress_type)
  @IsNotEmpty()
  type: LoanAddress_type;

  @ApiProperty({
    description: 'Address details',
    required: false
  })
  @IsString()
  @IsOptional()
  address?: string;
}
