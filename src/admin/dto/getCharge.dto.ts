import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetChargeDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  caseId?: number;
}

// Combine with pagination
export class GetChargeWithPaginationDto extends IntersectionType(
  GetChargeDto,
  PaginationDto,
) { }