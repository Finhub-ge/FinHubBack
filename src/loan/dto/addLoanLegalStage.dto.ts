import { IsNotEmpty, IsNumber, IsNumberString, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddLoanLegalStageDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  stageId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumberString()
  principal?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumberString()
  interest?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumberString()
  other?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumberString()
  penalty?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumberString()
  legal?: string;
}
