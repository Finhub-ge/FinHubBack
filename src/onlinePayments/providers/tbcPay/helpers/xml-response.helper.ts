import { Injectable } from '@nestjs/common';
import { TbcPayResultCode } from '../enums/tbcpay-result-code.enum';

/**
 * Helper for building TBC Pay XML responses
 */
@Injectable()
export class XmlResponseHelper {
  /**
   * Build XML response for CHECK command success
   */
  buildCheckSuccessResponse(debtorInfo: {
    firstName: string;
    lastName: string;
    idNumber: string;
    debt: number;
  }): string {
    const fullName = `${debtorInfo.firstName} ${debtorInfo.lastName}`.trim();

    return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>0</result>
 <info>
  <extra name="Full Name">${this.escapeXml(fullName)}</extra>
  <extra name="Personal ID">${this.escapeXml(debtorInfo.idNumber)}</extra>
  <extra name="Debt">${debtorInfo.debt.toFixed(2)}</extra>
 </info>
 <comment>OK</comment>
</response>`;
  }

  /**
   * Build XML error response
   */
  buildErrorResponse(
    errorCode: number,
    errorMessage?: string,
  ): string {
    const message = errorMessage || this.getErrorMessage(errorCode);

    return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>${errorCode}</result>
 <comment>${this.escapeXml(message)}</comment>
</response>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get error message by code
   */
  private getErrorMessage(code: number): string {
    const messages = {
      [TbcPayResultCode.SERVER_TIMEOUT]: 'Temporary Database Error',
      [TbcPayResultCode.DUPLICATE]: 'Duplicate Transaction',
      [TbcPayResultCode.INVALID_AMOUNT]: 'Invalid Amount',
      [TbcPayResultCode.INVALID_FORMAT]: 'Invalid Format',
      [TbcPayResultCode.ACCOUNT_NOT_FOUND]: "The Account Doesn't Exist",
      [TbcPayResultCode.PAYMENT_PROHIBITED]: 'Payment Prohibited',
      [TbcPayResultCode.FATAL_ERROR]: 'System Error',
    };

    return messages[code] || 'Unknown Error';
  }
}
