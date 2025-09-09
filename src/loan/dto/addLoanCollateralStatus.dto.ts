import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddLoanCollateralStatusDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    collateralStatusId: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    comment?: string;
}
