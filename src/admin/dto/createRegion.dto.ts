import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateRegionDto {
  @ApiProperty({ description: 'Region name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Manager user IDs', required: false, type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  managerIds?: number[];

  @ApiProperty({ description: 'Active status', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
