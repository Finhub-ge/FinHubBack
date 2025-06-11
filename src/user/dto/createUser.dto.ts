import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsInt, IsNotEmpty, IsString } from "class-validator";

export class CreateUserDto {
    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;
  
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    first_name: string;
  
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    last_name: string;
  
    @ApiProperty()
    @IsInt()
    @IsNotEmpty()
    role_id: number;
}