import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class AddDebtorStatusDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  statusId: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  notes?: string;
}