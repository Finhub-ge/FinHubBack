import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateCommentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  comment: string;
}
