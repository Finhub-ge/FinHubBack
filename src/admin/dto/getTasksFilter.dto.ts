import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum TaskType {
  ASSIGNED_BY_ME = 'ASSIGNED_BY_ME',
  ASSIGNED_TO_ME = 'ASSIGNED_TO_ME'
}


export class GetTasksFilterDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: Number
  })
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  caseId?: number;

  @ApiProperty({ enum: TaskType, description: 'Type of task assignment', required: false })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({ description: 'Status of the task', required: false })
  @Transform(({ value }) => value ? Number(value) : undefined)
  @IsOptional()
  statusId?: number;

  @ApiProperty({ description: 'Employee user ID', required: false })
  @IsString()
  @IsOptional()
  employeeId?: number;

  @ApiProperty({ description: 'Start date for created date range', required: false })
  @IsDateString()
  @IsOptional()
  createdDateStart?: string;

  @ApiProperty({ description: 'End date for created date range', required: false })
  @IsDateString()
  @IsOptional()
  createdDateEnd?: string;

  @ApiProperty({ description: 'Start date for deadline range', required: false })
  @IsDateString()
  @IsOptional()
  deadlineDateStart?: string;

  @ApiProperty({ description: 'End date for deadline range', required: false })
  @IsDateString()
  @IsOptional()
  deadlineDateEnd?: string;

  @ApiProperty({ description: 'Start date for completion range', required: false })
  @IsDateString()
  @IsOptional()
  completeDateStart?: string;

  @ApiProperty({ description: 'End date for completion range', required: false })
  @IsDateString()
  @IsOptional()
  completeDateEnd?: string;
}

// Combine with pagination
export class GetTasksWithPaginationDto extends IntersectionType(
  GetTasksFilterDto,
  PaginationDto,
) { }
