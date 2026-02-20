import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt } from "class-validator";

export class UpdateTasksViewedDto {
  @ApiProperty({ type: [Number], description: "Array of task IDs to mark as viewed" })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}
