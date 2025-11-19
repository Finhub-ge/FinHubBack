import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetChargeDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.trim() : undefined)
  search?: string;
}

// Combine with pagination
export class GetChargeWithPaginationDto extends IntersectionType(
  GetChargeDto,
  PaginationDto,
) { }