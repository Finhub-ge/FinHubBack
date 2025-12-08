import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetPaymentDto {
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
export class GetPaymentWithPaginationDto extends IntersectionType(
  GetPaymentDto,
  PaginationDto,
) { }