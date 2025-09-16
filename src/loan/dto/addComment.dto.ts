import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AddCommentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  comment: string;

  @ApiProperty({ required: false, type: 'string', format: 'binary' })
  @IsOptional()
  attachment?: Express.Multer.File;
}