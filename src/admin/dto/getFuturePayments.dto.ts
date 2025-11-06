import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { PaymentCommitment_type } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class GetFuturePaymentsDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  search?: number;

  @ApiProperty({ description: 'Start date for payment date range', required: false })
  @IsDateString()
  @IsOptional()
  paymentDateStart?: string;

  @ApiProperty({ description: 'End date for payment date range', required: false })
  @IsDateString()
  @IsOptional()
  paymentDateEnd?: string;

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
    description: 'Filter by collector user IDs',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  assignedCollector?: number[];

  @ApiProperty({
    enum: PaymentCommitment_type,
    description: 'Type of payment commitment',
    required: false
  })
  @IsOptional()
  @IsEnum(PaymentCommitment_type)
  type?: PaymentCommitment_type;
}

export class GetFuturePaymentsWithPaginationDto extends IntersectionType(
  GetFuturePaymentsDto,
  PaginationDto
) { }