import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateCommitteeDto {
    @ApiProperty()
    @IsString()
    requestText: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsNotEmpty()
    agreementMinAmount: number;

    @ApiProperty({ required: false, type: 'string', format: 'binary' })
    @IsOptional()
    attachment?: Express.Multer.File;
}