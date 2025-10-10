import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty } from "class-validator";

export class UpdatePortfolioGroupDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  groupId: number;
}

