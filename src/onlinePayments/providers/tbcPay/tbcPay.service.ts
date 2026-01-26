import { Injectable, Logger } from '@nestjs/common';
import { TbcPayCheckRequestDto, TbcPayPayRequestDto } from './dto/tbcpay-request.dto';
import { XmlResponseHelper } from './helpers/xml-response.helper';
import { TbcPayResultCode } from './enums/tbcpay-result-code.enum';
import { OnlinePaymentCommonService } from '../../common/services/online-payment-common.service';

/**
 * TBC Pay Service - handles ONLY TBC-specific protocol
 * All business logic is in OnlinePaymentCommonService
 */
@Injectable()
export class TbcPayService {
  private readonly logger = new Logger(TbcPayService.name);
  private readonly PROVIDER_NAME = 'TBC';

  constructor(
    private readonly commonService: OnlinePaymentCommonService,
    private readonly xmlResponseHelper: XmlResponseHelper,
  ) {
    this.logger.log(`✓ TBC Pay Service initialized`);
  }

  /**
   * Handle CHECK command
   */
  async handleCheck(dto: TbcPayCheckRequestDto, ipAddress?: string): Promise<string> {
    try {
      this.logger.log(`CHECK request: caseId=${dto.caseId}, personalId=${dto.personalId || 'none'}, ip=${ipAddress}`);

      // Find loan by caseId
      const loanResult = await this.commonService.findLoanByCaseId(dto.caseId);

      if (!loanResult.success) {
        this.logger.warn(`CHECK failed: ${loanResult.error} (caseId=${dto.caseId})`);
        return this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.ACCOUNT_NOT_FOUND,
          loanResult.error
        );
      }

      // If personalId provided, validate it matches debtor
      if (dto.personalId) {
        const normalizedProvidedId = dto.personalId.toLowerCase().trim();
        const normalizedDebtorId = loanResult.debtor.idNumber.toLowerCase().trim();

        if (normalizedProvidedId !== normalizedDebtorId) {
          this.logger.warn(
            `CHECK failed: Personal ID mismatch (provided=${dto.personalId}, expected=${loanResult.debtor.idNumber})`
          );
          return this.xmlResponseHelper.buildErrorResponse(
            TbcPayResultCode.ACCOUNT_NOT_FOUND,
            "The Account Doesn't Exist"
          );
        }

        this.logger.log(`✓ Personal ID validated: ${dto.personalId}`);
      }

      // Build success response
      const response = this.xmlResponseHelper.buildCheckSuccessResponse({
        firstName: loanResult.debtor.firstName,
        lastName: loanResult.debtor.lastName,
        idNumber: loanResult.debtor.idNumber,
        debt: loanResult.debt,
      });

      this.logger.log(`✓ CHECK successful: caseId=${dto.caseId}, debt=${loanResult.debt}`);

      return response;

    } catch (error) {
      this.logger.error('CHECK error:', error);
      return this.xmlResponseHelper.buildErrorResponse(TbcPayResultCode.SERVER_TIMEOUT);
    }
  }

  /**
   * Handle PAY command
   */
  async handlePay(dto: TbcPayPayRequestDto, ipAddress?: string): Promise<string> {
    try {
      this.logger.log(`PAY request: caseId=${dto.caseId}, txn_id=${dto.txn_id}, sum=${dto.sum}, ip=${ipAddress}`);

      // 1. Validate sum (amount > 0)
      const amount = parseFloat(dto.sum);
      if (isNaN(amount) || amount <= 0) {
        this.logger.warn(`PAY failed: Invalid amount (sum=${dto.sum})`);
        return this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.INVALID_AMOUNT,
          'Invalid Amount'
        );
      }

      // 2. Check for duplicate txn_id
      const isDuplicate = await this.commonService.checkDuplicateTransaction(dto.txn_id);
      if (isDuplicate) {
        this.logger.warn(`PAY failed: Duplicate transaction (txn_id=${dto.txn_id})`);
        return this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.DUPLICATE,
          'Duplicate Transaction'
        );
      }

      // 3. Find loan by caseId
      const loanResult = await this.commonService.findLoanByCaseId(dto.caseId);

      if (!loanResult.success) {
        this.logger.warn(`PAY failed: ${loanResult.error} (caseId=${dto.caseId})`);
        return this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.ACCOUNT_NOT_FOUND,
          loanResult.error
        );
      }

      // 4. Get TBC Pay channel account
      const channelAccountId = await this.commonService.getTbcPayChannelAccount();

      // 5. Process payment
      const paymentResult = await this.commonService.processOnlinePayment({
        loanId: loanResult.loan.id,
        amount: amount,
        txnId: dto.txn_id,
        channelAccountId,
        comment: `TBC Pay: txn_id=${dto.txn_id}, ip=${ipAddress}`,
      });

      if (!paymentResult.success) {
        this.logger.error(`PAY failed: ${paymentResult.error} (txn_id=${dto.txn_id})`);
        return this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.FATAL_ERROR,
          paymentResult.error
        );
      }

      // 6. Log to TbcPayTransaction table
      await this.commonService.logTbcPayTransaction({
        txnId: dto.txn_id,
        command: 'pay',
        caseId: dto.caseId,
        sum: amount,
        resultCode: 0,
        resultMessage: 'OK',
        ipAddress,
        transactionId: paymentResult.transactionId,
      });

      this.logger.log(`✓ PAY successful: caseId=${dto.caseId}, txn_id=${dto.txn_id}, sum=${dto.sum}, transactionId=${paymentResult.transactionId}`);

      return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>0</result>
 <comment>OK</comment>
</response>`;

    } catch (error) {
      this.logger.error('PAY error:', error);
      return this.xmlResponseHelper.buildErrorResponse(TbcPayResultCode.SERVER_TIMEOUT);
    }
  }

}
