import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Committee_status, Committee_type } from "@prisma/client";

export class GetCommiteesDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.trim() : undefined)
  search?: string;

  @ApiProperty({ enum: Committee_type, description: 'Type of the committee', required: false })
  @IsEnum(Committee_type)
  @IsOptional()
  type?: Committee_type;

  @ApiProperty({ enum: Committee_status, description: 'Status of the committee', required: false })
  @IsEnum(Committee_status)
  @IsOptional()
  status?: Committee_status;

  @ApiProperty({ description: 'Start date for created date range', required: false })
  @IsDateString()
  @IsOptional()
  createdDateStart?: string;

  @ApiProperty({ description: 'End date for created date range', required: false })
  @IsDateString()
  @IsOptional()
  createdDateEnd?: string;
}

// Combine with pagination
export class GetCommiteesWithPaginationDto extends IntersectionType(
  GetCommiteesDto,
  PaginationDto,
) { }