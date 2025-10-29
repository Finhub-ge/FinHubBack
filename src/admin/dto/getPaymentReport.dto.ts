import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetPaymentReportDto {
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
  portfolioId?: number[];

  @ApiProperty({
    description: 'Filter by portfolio seller IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  portfolioseller?: number[];

  @ApiProperty({
    description: 'Filter by collector user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedCollector?: number[];

  @ApiProperty({ description: 'Start date for payment date range', required: false })
  @IsDateString()
  @IsOptional()
  paymentDateStart?: string;

  @ApiProperty({ description: 'End date for payment date range', required: false })
  @IsDateString()
  @IsOptional()
  paymentDateEnd?: string;

  @ApiProperty({
    description: 'Filter by account number IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  accountNumber?: number[];

  @ApiProperty({ description: 'Filter by currency', required: false, enum: ['GEL', 'USD', 'EUR'] })
  @IsOptional()
  currency?: 'GEL' | 'USD' | 'EUR';
}

export class GetPaymentReportWithPaginationDto extends IntersectionType(
  GetPaymentReportDto,
  PaginationDto
) { }