import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetPlanReportDto {
  @ApiProperty({
    description: 'Year',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  year?: number[];

  @ApiProperty({
    description: 'Month',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  month?: number[];

  @ApiProperty({
    description: 'Date',
    required: false,
    type: Date
  })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  date?: Date;

  @ApiProperty({
    description: 'Collector ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  collectorId?: number[];
}

export class GetPlanReportWithPaginationDto extends IntersectionType(
  GetPlanReportDto,
  PaginationDto
) { }