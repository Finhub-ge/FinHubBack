import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateMarksDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;
}
