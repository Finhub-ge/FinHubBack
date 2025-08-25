import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber } from "class-validator";
import { Committee_type } from "@prisma/client";

export class ResponseCommitteeDto {
    @ApiProperty({ description: 'Response text for the committee request' })
    @IsString()
    @IsNotEmpty()
    responseText: string;

    @ApiProperty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsNotEmpty()
    agreementMinAmount: number;

    @ApiProperty({
        description: 'Committee type',
        enum: Committee_type,
        example: Committee_type.discount,
        required: false
    })
    @IsEnum(Committee_type)
    @IsOptional()
    type?: Committee_type;
}
