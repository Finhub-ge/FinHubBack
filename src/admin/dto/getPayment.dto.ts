import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetPaymentDto {
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
export class GetPaymentWithPaginationDto extends IntersectionType(
  GetPaymentDto,
  PaginationDto,
) { }