import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateRegionDto {
  @ApiProperty({ description: 'Region name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Manager user IDs', required: false, type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  managerIds?: number[];

  @ApiProperty({ description: 'Active status', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
