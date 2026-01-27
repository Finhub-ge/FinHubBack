import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateRegionDto {
  @ApiProperty({ description: 'Region name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Manager user ID', required: false })
  @IsInt()
  @IsOptional()
  managerId?: number;

  @ApiProperty({ description: 'Active status', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
