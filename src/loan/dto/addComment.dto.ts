import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AddCommentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  comment: string;
}