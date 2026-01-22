import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt } from "class-validator";

export class AssignTeamsToRegionDto {
  @ApiProperty({ description: 'Array of team IDs to assign', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  teamIds: number[];
}
