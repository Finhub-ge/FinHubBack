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

  @ApiProperty({
    enum: Role,
    description: 'Role(s) of user',
    required: false,
    isArray: true,
    type: [String],
  })
  @IsOptional()
  @IsEnum(Role, { each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return value.split(',').map((v: string) => v.trim());
  })
  role?: Role[];

  @ApiProperty({ type: Boolean, description: 'Status of user', required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;
}

// Combine with pagination
export class GetUsersWithPaginationDto extends IntersectionType(
  GetUsersFilterDto,
  PaginationDto,
) { }