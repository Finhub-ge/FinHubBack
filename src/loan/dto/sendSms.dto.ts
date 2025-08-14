import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsPhoneNumber, IsString } from "class-validator";

export class SendSmsDto {
  @ApiProperty()
  @IsNotEmpty()
  contactId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}