import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Role } from "src/enums/role.enum";

export class GetUsersFilterDto {
  @ApiProperty({
    description: 'Search by case ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.trim() : undefined)
  search?: string;

  @ApiProperty({ enum: Role, description: 'Role of user', required: false })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

// Combine with pagination
export class GetUsersWithPaginationDto extends IntersectionType(
  GetUsersFilterDto,
  PaginationDto,
) { }