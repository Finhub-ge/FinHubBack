import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddLoanLegalStageDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    stageId: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    comment?: string;
}
