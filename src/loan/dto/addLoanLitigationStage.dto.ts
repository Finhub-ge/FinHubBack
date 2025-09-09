import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddLoanLitigationStageDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    litigationStageId: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    comment?: string;
}
