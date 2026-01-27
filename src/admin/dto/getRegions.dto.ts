import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class GetRegionsFilterDto {
  @ApiProperty({ description: 'Search by region name or manager name', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? value.trim() : undefined)
  search?: string;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}
