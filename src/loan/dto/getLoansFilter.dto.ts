import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common";

export class GetLoansFilterDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  caseId?: number;

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
    description: 'Filter by loan status IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  loanstatus?: number[];

  @ApiProperty({
    description: 'Filter by assigned user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assigneduser?: number[];

  @ApiProperty({
    description: 'Filter by collateral status IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  collateralstatus?: number[];

  @ApiProperty({
    description: 'Filter by litigation stage IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  litigationstage?: number[];

  @ApiProperty({
    description: 'Filter by legal stage IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  legalstage?: number[];

  @ApiProperty({
    description: 'Filter by marks IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  marks?: number[];

  @ApiProperty({
    description: 'Search by act days',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  actDays?: number;

  @ApiProperty({
    description: 'Columns to include in export (comma-separated or array)',
    required: false,
    type: String,
    example: 'caseId,portfolio,loanstatus'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : value.split(',');
  })
  columns?: string[];
}

// Combine with pagination
export class GetLoansFilterWithPaginationDto extends IntersectionType(
  GetLoansFilterDto,
  PaginationDto,
) { }