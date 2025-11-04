import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateTaskResponseDto {
  task
  @ApiProperty({
    description: 'Task status ID',
    required: true,
    type: Number
  })
  @IsNotEmpty()
  @IsNumber()
  taskStatusId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response: string;
}