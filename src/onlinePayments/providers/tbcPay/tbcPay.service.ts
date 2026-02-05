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
      this.logger.log(`━━━ CHECK Handler Started ━━━`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   PersonalId: ${dto.personalId || 'none'}`);
      this.logger.log(`   IP: ${ipAddress}`);

      // Find loan by caseId
      this.logger.log(`🔍 Step 1: Finding loan by caseId...`);
      const loanResult = await this.commonService.findLoanByCaseId(dto.caseId);
      this.logger.log(`   Loan lookup result: ${loanResult.success ? 'FOUND' : 'NOT FOUND'}`);

      if (!loanResult.success) {
        this.logger.error(`❌ Step 1 FAILED: Loan not found`);
        this.logger.error(`   Error: ${loanResult.error}`);
        this.logger.error(`   CaseId: ${dto.caseId}`);

        this.logger.log(`🔨 Building error XML response...`);
        const errorResponse = this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.ACCOUNT_NOT_FOUND,
          loanResult.error
        );

        this.logger.log(`💾 Logging to database...`);
        await this.commonService.logTbcPayTransaction({
          txnId: `CHECK-${dto.caseId}-${Date.now()}`,
          command: 'check',
          caseId: dto.caseId,
          personalId: dto.personalId,
          resultCode: TbcPayResultCode.ACCOUNT_NOT_FOUND,
          resultMessage: loanResult.error,
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });

        this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.ACCOUNT_NOT_FOUND})`);
        return errorResponse;
      }

      this.logger.log(`✓ Step 1 SUCCESS: Loan found`);
      this.logger.log(`   Loan ID: ${loanResult.loan.id}`);
      this.logger.log(`   Debtor: ${loanResult.debtor.firstName} ${loanResult.debtor.lastName}`);
      this.logger.log(`   Debt: ${loanResult.debt}`);

      // If personalId provided, validate it matches debtor
      if (dto.personalId) {
        this.logger.log(`🔍 Step 2: Validating personalId...`);
        this.logger.log(`   Provided: ${dto.personalId}`);
        this.logger.log(`   Expected: ${loanResult.debtor.idNumber}`);

        const normalizedProvidedId = dto.personalId.toLowerCase().trim();
        const normalizedDebtorId = loanResult.debtor.idNumber.toLowerCase().trim();
        this.logger.log(`   Normalized provided: ${normalizedProvidedId}`);
        this.logger.log(`   Normalized expected: ${normalizedDebtorId}`);

        if (normalizedProvidedId !== normalizedDebtorId) {
          this.logger.error(`❌ Step 2 FAILED: Personal ID mismatch`);
          this.logger.error(`   Provided: ${normalizedProvidedId}`);
          this.logger.error(`   Expected: ${normalizedDebtorId}`);

          this.logger.log(`🔨 Building error XML response...`);
          const errorResponse = this.xmlResponseHelper.buildErrorResponse(
            TbcPayResultCode.ACCOUNT_NOT_FOUND,
            "The Account Doesn't Exist"
          );

          this.logger.log(`💾 Logging to database...`);
          await this.commonService.logTbcPayTransaction({
            txnId: `CHECK-${dto.caseId}-${Date.now()}`,
            command: 'check',
            caseId: dto.caseId,
            personalId: dto.personalId,
            resultCode: TbcPayResultCode.ACCOUNT_NOT_FOUND,
            resultMessage: "The Account Doesn't Exist",
            ipAddress,
            requestData: JSON.stringify(dto),
            responseData: errorResponse,
          });

          this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.ACCOUNT_NOT_FOUND})`);
          return errorResponse;
        }

        this.logger.log(`✓ Step 2 SUCCESS: Personal ID validated`);
      } else {
        this.logger.log(`⊘ Step 2 SKIPPED: No personalId provided`);
      }

      // Build success response
      this.logger.log(`🔨 Step 3: Building success XML response...`);
      this.logger.log(`   Debtor: ${loanResult.debtor.firstName} ${loanResult.debtor.lastName}`);
      this.logger.log(`   ID: ${loanResult.debtor.idNumber}`);
      this.logger.log(`   Debt: ${loanResult.debt}`);

      const response = this.xmlResponseHelper.buildCheckSuccessResponse({
        firstName: loanResult.debtor.firstName,
        lastName: loanResult.debtor.lastName,
        idNumber: loanResult.debtor.idNumber,
        debt: loanResult.debt,
      });

      this.logger.log(`✓ Step 3 SUCCESS: XML built`);

      this.logger.log(`💾 Step 4: Logging to database...`);
      await this.commonService.logTbcPayTransaction({
        txnId: `CHECK-${dto.caseId}-${Date.now()}`,
        command: 'check',
        caseId: dto.caseId,
        personalId: dto.personalId,
        resultCode: 0,
        resultMessage: 'OK',
        ipAddress,
        requestData: JSON.stringify(dto),
        responseData: response,
      });

      this.logger.log(`✓ Step 4 SUCCESS: Logged to database`);
      this.logger.log(`✅ CHECK COMPLETED SUCCESSFULLY`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   Debt: ${loanResult.debt}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return response;

    } catch (error) {
      this.logger.error(`❌❌❌ CHECK EXCEPTION CAUGHT ❌❌❌`);
      this.logger.error(`   Error type: ${error.constructor.name}`);
      this.logger.error(`   Error message: ${error.message}`);
      this.logger.error(`   Error stack: ${error.stack}`);
      this.logger.error(`   CaseId: ${dto.caseId}`);

      this.logger.log(`🔨 Building server timeout error response...`);
      const errorResponse = this.xmlResponseHelper.buildErrorResponse(TbcPayResultCode.SERVER_TIMEOUT);

      // Log to database
      this.logger.log(`💾 Attempting to log error to database...`);
      try {
        await this.commonService.logTbcPayTransaction({
          txnId: `CHECK-${dto.caseId}-${Date.now()}`,
          command: 'check',
          caseId: dto.caseId,
          personalId: dto.personalId,
          resultCode: TbcPayResultCode.SERVER_TIMEOUT,
          resultMessage: 'Temporary Database Error',
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });
        this.logger.log(`✓ Error logged to database`);
      } catch (logError) {
        this.logger.error(`❌ Failed to log CHECK error to database:`, logError);
      }

      this.logger.log(`📤 Returning server timeout error response`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return errorResponse;
    }
  }

  /**
   * Handle PAY command
   */
  async handlePay(dto: TbcPayPayRequestDto, ipAddress?: string): Promise<string> {
    try {
      this.logger.log(`━━━ PAY Handler Started ━━━`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   TxnId: ${dto.txn_id}`);
      this.logger.log(`   Sum: ${dto.sum}`);
      this.logger.log(`   IP: ${ipAddress}`);

      // 1. Validate sum (amount > 0)
      this.logger.log(`💵 Step 1: Validating amount...`);
      this.logger.log(`   Raw sum: ${dto.sum}`);
      const amount = parseFloat(dto.sum);
      this.logger.log(`   Parsed amount: ${amount}`);

      if (isNaN(amount) || amount <= 0) {
        this.logger.error(`❌ Step 1 FAILED: Invalid amount`);
        this.logger.error(`   Sum: ${dto.sum}`);
        this.logger.error(`   Parsed: ${amount}`);
        this.logger.error(`   IsNaN: ${isNaN(amount)}`);
        this.logger.error(`   <= 0: ${amount <= 0}`);

        this.logger.log(`🔨 Building error XML response...`);
        const errorResponse = this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.INVALID_AMOUNT,
          'Invalid Amount'
        );

        this.logger.log(`💾 Logging to database...`);
        await this.commonService.logTbcPayTransaction({
          txnId: dto.txn_id,
          command: 'pay',
          caseId: dto.caseId,
          sum: amount,
          resultCode: TbcPayResultCode.INVALID_AMOUNT,
          resultMessage: 'Invalid Amount',
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });

        this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.INVALID_AMOUNT})`);
        return errorResponse;
      }

      this.logger.log(`✓ Step 1 SUCCESS: Amount validated (${amount})`);

      // 2. Check for duplicate txn_id
      this.logger.log(`🔍 Step 2: Checking for duplicate transaction...`);
      this.logger.log(`   TxnId: ${dto.txn_id}`);
      const isDuplicate = await this.commonService.checkDuplicateTransaction(dto.txn_id);
      this.logger.log(`   Duplicate check result: ${isDuplicate ? 'DUPLICATE' : 'UNIQUE'}`);

      if (isDuplicate) {
        this.logger.error(`❌ Step 2 FAILED: Duplicate transaction`);
        this.logger.error(`   TxnId: ${dto.txn_id}`);

        this.logger.log(`🔨 Building error XML response...`);
        const errorResponse = this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.DUPLICATE,
          'Duplicate Transaction'
        );

        this.logger.log(`⊘ Skipping database logging (duplicate already exists)`);
        this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.DUPLICATE})`);
        return errorResponse;
      }

      this.logger.log(`✓ Step 2 SUCCESS: Transaction is unique`);

      // 3. Find loan by caseId
      this.logger.log(`🔍 Step 3: Finding loan by caseId...`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      const loanResult = await this.commonService.findLoanByCaseId(dto.caseId);
      this.logger.log(`   Loan lookup result: ${loanResult.success ? 'FOUND' : 'NOT FOUND'}`);

      if (!loanResult.success) {
        this.logger.error(`❌ Step 3 FAILED: Loan not found`);
        this.logger.error(`   Error: ${loanResult.error}`);
        this.logger.error(`   CaseId: ${dto.caseId}`);

        this.logger.log(`🔨 Building error XML response...`);
        const errorResponse = this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.ACCOUNT_NOT_FOUND,
          loanResult.error
        );

        this.logger.log(`💾 Logging to database...`);
        await this.commonService.logTbcPayTransaction({
          txnId: dto.txn_id,
          command: 'pay',
          caseId: dto.caseId,
          sum: amount,
          resultCode: TbcPayResultCode.ACCOUNT_NOT_FOUND,
          resultMessage: loanResult.error,
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });

        this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.ACCOUNT_NOT_FOUND})`);
        return errorResponse;
      }

      this.logger.log(`✓ Step 3 SUCCESS: Loan found`);
      this.logger.log(`   Loan ID: ${loanResult.loan.id}`);
      this.logger.log(`   Debtor: ${loanResult.debtor.firstName} ${loanResult.debtor.lastName}`);
      this.logger.log(`   Debt: ${loanResult.debt}`);

      // 4. Get TBC Pay channel account
      this.logger.log(`🏦 Step 4: Getting TBC Pay channel account...`);
      const channelAccountId = await this.commonService.getTbcPayChannelAccount();
      this.logger.log(`✓ Step 4 SUCCESS: Channel account ID: ${channelAccountId}`);

      // 5. Process payment
      this.logger.log(`💰 Step 5: Processing payment...`);
      this.logger.log(`   Loan ID: ${loanResult.loan.id}`);
      this.logger.log(`   Amount: ${amount}`);
      this.logger.log(`   TxnId: ${dto.txn_id}`);
      this.logger.log(`   Channel Account: ${channelAccountId}`);

      const paymentResult = await this.commonService.processOnlinePayment({
        loanId: loanResult.loan.id,
        amount: amount,
        txnId: dto.txn_id,
        channelAccountId,
        comment: `TBC Pay: txn_id=${dto.txn_id}, ip=${ipAddress}`,
      });

      this.logger.log(`   Payment processing result: ${paymentResult.success ? 'SUCCESS' : 'FAILED'}`);

      if (!paymentResult.success) {
        this.logger.error(`❌ Step 5 FAILED: Payment processing error`);
        this.logger.error(`   Error: ${paymentResult.error}`);
        this.logger.error(`   TxnId: ${dto.txn_id}`);

        this.logger.log(`🔨 Building error XML response...`);
        const errorResponse = this.xmlResponseHelper.buildErrorResponse(
          TbcPayResultCode.FATAL_ERROR,
          paymentResult.error
        );

        this.logger.log(`💾 Logging to database...`);
        await this.commonService.logTbcPayTransaction({
          txnId: dto.txn_id,
          command: 'pay',
          caseId: dto.caseId,
          sum: amount,
          resultCode: TbcPayResultCode.FATAL_ERROR,
          resultMessage: paymentResult.error,
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });

        this.logger.log(`📤 Returning error response (code=${TbcPayResultCode.FATAL_ERROR})`);
        return errorResponse;
      }

      this.logger.log(`✓ Step 5 SUCCESS: Payment processed`);
      this.logger.log(`   Transaction ID: ${paymentResult.transactionId}`);

      // 6. Build success response
      this.logger.log(`🔨 Step 6: Building success XML response...`);
      const successResponse = `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>0</result>
 <comment>OK</comment>
</response>`;
      this.logger.log(`✓ Step 6 SUCCESS: XML built`);

      // 7. Log to TbcPayTransaction table
      this.logger.log(`💾 Step 7: Logging to database...`);
      await this.commonService.logTbcPayTransaction({
        txnId: dto.txn_id,
        command: 'pay',
        caseId: dto.caseId,
        sum: amount,
        resultCode: 0,
        resultMessage: 'OK',
        ipAddress,
        transactionId: paymentResult.transactionId,
        requestData: JSON.stringify(dto),
        responseData: successResponse,
      });
      this.logger.log(`✓ Step 7 SUCCESS: Logged to database`);

      this.logger.log(`✅ PAY COMPLETED SUCCESSFULLY`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   TxnId: ${dto.txn_id}`);
      this.logger.log(`   Amount: ${amount}`);
      this.logger.log(`   Transaction ID: ${paymentResult.transactionId}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return successResponse;

    } catch (error) {
      this.logger.error(`❌❌❌ PAY EXCEPTION CAUGHT ❌❌❌`);
      this.logger.error(`   Error type: ${error.constructor.name}`);
      this.logger.error(`   Error message: ${error.message}`);
      this.logger.error(`   Error stack: ${error.stack}`);
      this.logger.error(`   CaseId: ${dto.caseId}`);
      this.logger.error(`   TxnId: ${dto.txn_id}`);

      this.logger.log(`🔨 Building server timeout error response...`);
      const errorResponse = this.xmlResponseHelper.buildErrorResponse(TbcPayResultCode.SERVER_TIMEOUT);

      // Log to database
      this.logger.log(`💾 Attempting to log error to database...`);
      try {
        await this.commonService.logTbcPayTransaction({
          txnId: dto.txn_id,
          command: 'pay',
          caseId: dto.caseId,
          resultCode: TbcPayResultCode.SERVER_TIMEOUT,
          resultMessage: 'Temporary Database Error',
          ipAddress,
          requestData: JSON.stringify(dto),
          responseData: errorResponse,
        });
        this.logger.log(`✓ Error logged to database`);
      } catch (logError) {
        this.logger.error(`❌ Failed to log PAY error to database:`, logError);
      }

      this.logger.log(`📤 Returning server timeout error response`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return errorResponse;
    }
  }

}
