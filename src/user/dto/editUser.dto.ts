import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional } from "class-validator";
import { TeamMembership_teamRole } from "@prisma/client";

export class EditUserDto {
    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    team_id?: number;

    @ApiProperty({ enum: TeamMembership_teamRole, required: false })
    @IsEnum(TeamMembership_teamRole)
    @IsOptional()
    team_role?: TeamMembership_teamRole;
}
