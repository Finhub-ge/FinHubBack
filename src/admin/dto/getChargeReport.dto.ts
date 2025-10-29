import { Transform } from "class-transformer";
import { IsDateString, IsOptional } from "class-validator";
import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetChargeReportDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  caseId?: number;

  @ApiProperty({ description: 'Start date for charge date range', required: false })
  @IsDateString()
  @IsOptional()
  chargeDateStart?: string;

  @ApiProperty({ description: 'End date for charge date range', required: false })
  @IsDateString()
  @IsOptional()
  chargeDateEnd?: string;

  @ApiProperty({
    description: 'Filter by collector user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedCollector?: number[];

  @ApiProperty({
    description: 'Filter by lawyer user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedLawyer?: number[];
}

export class GetChargeReportWithPaginationDto extends IntersectionType(
  GetChargeReportDto,
  PaginationDto
) { }