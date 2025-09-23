import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";

export class GetLoansFilterDto {
    @ApiProperty({
        description: 'Search by case ID',
        required: false,
        type: Number
    })
    @IsOptional()
    @Transform(({ value }) => value ? Number(value) : undefined)
    caseId?: number;

    @ApiProperty({
        description: 'Filter by portfolio IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    portfolio?: number[];

    @ApiProperty({
        description: 'Filter by portfolio seller IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    portfolioseller?: number[];

    @ApiProperty({
        description: 'Filter by loan status IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    loanstatus?: number[];

    @ApiProperty({
        description: 'Filter by assigned user IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    assigneduser?: number[];

    @ApiProperty({
        description: 'Filter by collateral status IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    collateralstatus?: number[];

    @ApiProperty({
        description: 'Filter by litigation stage IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    litigationstage?: number[];

    @ApiProperty({
        description: 'Filter by legal stage IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    legalstage?: number[];

    @ApiProperty({
        description: 'Filter by marks IDs',
        required: false,
        type: String
    })
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map(Number) : undefined)
    marks?: number[];
}