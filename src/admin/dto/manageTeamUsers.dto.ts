import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional } from "class-validator";
import { TeamMembership_teamRole } from "@prisma/client";

export class ManageTeamUsersDto {
    @ApiProperty({ type: [Number], description: 'Array of user IDs to manage in the team' })
    @IsArray()
    @IsInt({ each: true })
    @IsNotEmpty()
    userIds: number[];

    @ApiProperty({ enum: TeamMembership_teamRole, nullable: true, description: 'Role to assign (null = unassign users)' })
    @IsEnum(TeamMembership_teamRole)
    @IsOptional()
    team_role: TeamMembership_teamRole | null;
}
