import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddLoanMarksDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    markId: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    comment?: string;

    @ApiProperty()
    @IsDateString()
    @IsOptional()
    deadline?: string;
}
//for test
