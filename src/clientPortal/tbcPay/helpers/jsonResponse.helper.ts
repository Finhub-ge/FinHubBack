import { Injectable } from '@nestjs/common';
import { TbcPayResponseDto } from '../dto/tbcpayResponse.dto';
import { TbcPayResultCode, TbcPayResultMessage } from '../enums/tbcpayResultCode.enum';

@Injectable()
export class JsonResponseHelper {
  /**
   * Build success response for CHECK command
   */
  buildCheckSuccessResponse(
    debt: number,
    debtorInfo: {
      personalId: string;
      firstName: string;
      lastName: string;
      caseId: string;
    },
    debtDetails: {
      principal: number;
      interest: number;
      penalty: number;
      otherFee: number;
      legalCharges: number;
      totalDebt: number;
    }
  ): TbcPayResponseDto {
    return {
      status: {
        code: TbcPayResultCode.SUCCESS,
        message: TbcPayResultMessage[TbcPayResultCode.SUCCESS],
      },
      timestamp: Math.floor(Date.now() / 1000),
      debt,
      clientInfo: {
        personalId: debtorInfo.personalId,
        firstName: debtorInfo.firstName,
        lastName: debtorInfo.lastName,
        caseId: debtorInfo.caseId,
      },
      debtDetails: {
        principal: debtDetails.principal,
        interest: debtDetails.interest,
        penalty: debtDetails.penalty,
        otherFee: debtDetails.otherFee,
        legalCharges: debtDetails.legalCharges,
        totalDebt: debtDetails.totalDebt,
      },
    };
  }

  /**
   * Build success response for PAY command
   */
  buildPaySuccessResponse(): TbcPayResponseDto {
    return {
      status: {
        code: TbcPayResultCode.SUCCESS,
        message: TbcPayResultMessage[TbcPayResultCode.SUCCESS],
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Build error response
   */
  buildErrorResponse(code: TbcPayResultCode, customMessage?: string): TbcPayResponseDto {
    return {
      status: {
        code,
        message: customMessage || TbcPayResultMessage[code],
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
  }
}
