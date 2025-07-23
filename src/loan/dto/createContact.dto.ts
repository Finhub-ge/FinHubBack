import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateContactDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  typeId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  value: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  labelId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  isPrimary: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
