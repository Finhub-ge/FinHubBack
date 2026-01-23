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

}
