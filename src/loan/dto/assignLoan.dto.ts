import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AssignLoanDto {
  @ApiProperty()
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiProperty()
  @IsInt()
  roleId: number;

  @ApiProperty({
    description: 'When unassigning a lawyer (userId is null), set to true to hide the LawyerRequest and prevent future requests',
    required: false
  })
  @IsBoolean()
  @IsOptional()
  hideRequest?: boolean;

  @ApiProperty({
    description: 'Comment/reason for assignment or unassignment',
    required: false
  })
  @IsString()
  @IsOptional()
  comment?: string;
}