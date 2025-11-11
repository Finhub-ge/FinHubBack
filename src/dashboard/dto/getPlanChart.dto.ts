import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { Transform } from "class-transformer";

export class GetPlanChartDto {
  @ApiProperty({
    description: 'Year',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  year?: number[];

  // @ApiProperty({
  //   description: 'Month',
  //   required: false,
  //   type: String
  // })
  // @IsOptional()
  // @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  // month?: number[];

  @ApiProperty({
    description: 'Collector ID',
    required: false,
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
  collectorId?: number[];
}