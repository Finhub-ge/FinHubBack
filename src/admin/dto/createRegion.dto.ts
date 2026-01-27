import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateRegionDto {
  @ApiProperty({ description: 'Region name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Manager user ID', required: false })
  @IsInt()
  @IsOptional()
  managerId?: number;

  @ApiProperty({ description: 'Active status', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
