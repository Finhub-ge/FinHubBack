import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

/**
 * TBC Pay CHECK request DTO
 */
export class TbcPayCheckRequestDto {
  @ApiProperty({
    enum: ['check'],
    example: 'check',
    description: 'Command type'
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['check'])
  command: 'check';

  @ApiProperty({
    description: 'Case identifier (Loan.caseId)',
    example: 'FL-2024-001234'
  })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({
    description: 'Personal ID for validation',
    example: '01234567890',
    required: false
  })
  @IsString()
  @IsOptional()
  personalId?: string;
}

/**
 * TBC Pay PAY request DTO (to be implemented)
 */
export class TbcPayPayRequestDto {
  @ApiProperty({ enum: ['pay'], example: 'pay' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['pay'])
  command: 'pay';

  // TODO: Add PAY command parameters
}
