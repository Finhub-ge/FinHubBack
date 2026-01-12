import { ApiProperty } from '@nestjs/swagger';

export class TbcPayStatusDto {
  @ApiProperty()
  code: number;

  @ApiProperty()
  message: string;
}

export class TbcPayClientInfoDto {
  @ApiProperty()
  personalId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  caseId: string;
}

export class TbcPayDebtDetailsDto {
  @ApiProperty()
  principal: number;

  @ApiProperty()
  interest: number;

  @ApiProperty()
  penalty: number;

  @ApiProperty()
  otherFee: number;

  @ApiProperty()
  legalCharges: number;

  @ApiProperty()
  totalDebt: number;
}

export class TbcPayResponseDto {
  @ApiProperty()
  status: TbcPayStatusDto;

  @ApiProperty()
  timestamp: number;

  @ApiProperty()
  debt?: number;

  @ApiProperty()
  clientInfo?: TbcPayClientInfoDto;

  @ApiProperty()
  debtDetails?: TbcPayDebtDetailsDto;
}
