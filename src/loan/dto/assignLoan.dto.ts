import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AssignLoanDto {
    @ApiProperty()
    @IsInt()
    @IsOptional()
    userId?: number;

    @ApiProperty()
    @IsInt()
    roleId: number;
}