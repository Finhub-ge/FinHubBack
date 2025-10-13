import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateTeamDto {
  @ApiProperty({ description: 'Team name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Team description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

