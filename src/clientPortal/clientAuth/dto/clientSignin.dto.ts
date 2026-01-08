import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class ClientSigninDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(11, 11, { message: 'Personal ID must be exactly 11 characters' })
  personalId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phone: string;
}