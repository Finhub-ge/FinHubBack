import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Role } from "src/enums/role.enum";

export class GetUsersFilterDto {
    @ApiProperty({ enum: Role, description: 'Role of user', required: false })
    @IsEnum(Role)
    @IsOptional()
    role?: Role;
}