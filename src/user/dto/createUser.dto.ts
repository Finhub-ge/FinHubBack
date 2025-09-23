import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TeamMembership_teamRole } from "@prisma/client";

export class CreateUserDto {
    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    first_name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    last_name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty()
    @IsInt()
    @IsNotEmpty()
    role_id: number;

    @ApiProperty()
    @IsInt()
    @IsOptional()
    team_id: number;

    @ApiProperty({ enum: TeamMembership_teamRole, default: TeamMembership_teamRole.member })
    @IsEnum(TeamMembership_teamRole)
    @IsOptional()
    team_role: TeamMembership_teamRole;
}