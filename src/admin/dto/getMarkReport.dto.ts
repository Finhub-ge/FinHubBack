import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetMarkReportDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  caseId?: number;

  @ApiProperty({
    description: 'Filter by assigned user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assigneduser?: number[];

  @ApiProperty({
    description: 'Filter by portfolio IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  portfolio?: number[];

  @ApiProperty({
    description: 'Filter by portfolio seller IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  portfolioseller?: number[];

  @ApiProperty({
    description: 'Filter by marks IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  marks?: number[];
}

// Combine with pagination
export class GetMarkReportWithPaginationDto extends IntersectionType(
  GetMarkReportDto,
  PaginationDto,
) { }