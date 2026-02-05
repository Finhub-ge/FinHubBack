import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common";

export class GetAssignedCasesFilterDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.trim() : undefined)
  search?: string;

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
  portfolioSeller?: number[];

  @ApiProperty({
    description: 'Filter by from assigned user IDs (previous collector)',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  fromAssignedUser?: number[];

  @ApiProperty({
    description: 'Filter by to assigned user IDs (current collector)',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  toAssignedUser?: number[];

  @ApiProperty({
    description: 'Filter by assigned lawyer user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedLawyer?: number[];

  @ApiProperty({
    description: 'Filter by collateral status IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  collateralStatus?: number[];

  @ApiProperty({
    description: 'Filter by client status IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  clientStatus?: number[];

  @ApiProperty({
    description: 'Filter by loan status IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  loanStatus?: number[];

  @ApiProperty({
    description: 'Filter by litigation stage IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  litigationStage?: number[];

  @ApiProperty({
    description: 'Filter by legal stage IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  legalStage?: number[];

  @ApiProperty({
    description: 'Filter by marks IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  marks?: number[];

  @ApiProperty({
    description: 'Filter by assigned by user IDs (user who created the assignment)',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedBy?: number[];

  @ApiProperty({ description: 'Start date for assigned date range', required: false })
  @IsDateString()
  @IsOptional()
  assignedDateStart?: string;

  @ApiProperty({ description: 'End date for assigned date range', required: false })
  @IsDateString()
  @IsOptional()
  assignedDateEnd?: string;

  @ApiProperty({
    description: 'Columns to include in export (comma-separated or array)',
    required: false,
    type: String,
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
export class GetAssignedCasesFilterWithPaginationDto extends IntersectionType(
  GetAssignedCasesFilterDto,
  PaginationDto,
) { }
