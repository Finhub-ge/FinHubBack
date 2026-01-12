import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Length, IsIn } from 'class-validator';

export class TbcPayBaseRequestDto {
  @ApiProperty({
    enum: ['check', 'pay'],
    example: 'check',
    description: 'Command type: check (verify account) or pay (process payment)'
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['check', 'pay'])
  command: 'check' | 'pay';

  @ApiProperty({
    description: 'Personal ID when paying own loan',
    example: '01024056784',
    required: false
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'Personal ID must be exactly 11 characters' })
  personal_id?: string;

  @ApiProperty({
    description: 'Payer personal ID when paying someone else loan',
    example: '99988877766',
    required: false
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'Payer personal ID must be exactly 11 characters' })
  payer_personal_id?: string;

  @ApiProperty({
    description: 'Debtor personal ID when paying someone else loan',
    example: '01024056784',
    required: false
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'Debtor personal ID must be exactly 11 characters' })
  debtor_personal_id?: string;

  @ApiProperty({
    description: 'Loan case ID',
    example: 'FL-2024-001234'
  })
  @IsString()
  @IsNotEmpty()
  case_id: string;
}

export class TbcPayCheckRequestDto extends TbcPayBaseRequestDto {
  @ApiProperty({ enum: ['check'], example: 'check' })
  command: 'check';
}

export class TbcPayPayRequestDto extends TbcPayBaseRequestDto {
  @ApiProperty({ enum: ['pay'], example: 'pay' })
  command: 'pay';

  @ApiProperty({
    description: 'Unique TBC transaction ID',
    example: 'TBC123456'
  })
  @IsString()
  @IsNotEmpty()
  txn_id: string;

  @ApiProperty({
    description: 'Payment amount in GEL',
    example: '500.00'
  })
  @IsString()
  @IsNotEmpty()
  sum: string;
}
