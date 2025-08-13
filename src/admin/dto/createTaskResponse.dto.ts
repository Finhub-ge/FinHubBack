import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateTaskResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response: string;
}