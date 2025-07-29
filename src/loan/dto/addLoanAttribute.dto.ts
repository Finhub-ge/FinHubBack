import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class AddLoanAttributesDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  attributeId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  value: string;
}
