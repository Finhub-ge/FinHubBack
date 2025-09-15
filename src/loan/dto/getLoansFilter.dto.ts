import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";

export class GetLoansFilterDto {
    @ApiProperty({
        description: 'Filter by portfolio IDs',
        example: '1,2,3',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    portfolio?: number[];

    @ApiProperty({
        description: 'Filter by portfolio seller IDs',
        example: '1,2',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    portfolioseller?: number[];

    @ApiProperty({
        description: 'Filter by loan status IDs',
        example: '1,3,5',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    loanstatus?: number[];

    @ApiProperty({
        description: 'Filter by assigned user IDs',
        example: '4,7',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    assigneduser?: number[];

    @ApiProperty({
        description: 'Filter by collateral status IDs',
        example: '2,4,6',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    collateralstatus?: number[];

    @ApiProperty({
        description: 'Filter by litigation stage IDs',
        example: '2,3,8',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    litigationstage?: number[];

    @ApiProperty({
        description: 'Filter by legal stage IDs',
        example: '1,2,4',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    legalstage?: number[];

    @ApiProperty({
        description: 'Filter by marks IDs',
        example: '2',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    marks?: number[];
}