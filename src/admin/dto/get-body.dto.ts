import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsNumber } from 'class-validator';

export class GetBodyDto {
    @ApiProperty({
        description: 'Full name of the person',
        example: 'John Doe'
    })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({
        description: 'ID number',
        example: '123456789'
    })
    @IsString()
    @IsNotEmpty()
    ID: string;

    @ApiProperty({
        description: 'Insurance date',
        example: '2024-01-15'
    })
    @IsDateString()
    @IsNotEmpty()
    insuranseDate: string;

    @ApiProperty({
        description: 'Document number',
        example: 'DOC-2024-001'
    })
    @IsString()
    @IsNotEmpty()
    docNumber: string;

    @ApiProperty({
        description: 'Amount',
        example: 1000.50
    })
    @IsNumber()
    @IsNotEmpty()
    amount: number;
}
