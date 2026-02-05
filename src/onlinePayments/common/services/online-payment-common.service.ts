import { Injectable, Logger } from '@nestjs/common';
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import { randomUUID } from 'crypto';
import {
  ProcessOnlinePaymentParams,
  ProcessOnlinePaymentResult,
  LogTbcPayTransactionParams,
  FindLoanByCaseIdResult,
} from '../interfaces/payment.interface';

/**
 * Common service for all online payment providers
 */
@Injectable()
export class OnlinePaymentCommonService {
  private readonly logger = new Logger(OnlinePaymentCommonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsHelper: PaymentsHelper,
  ) { }

  /**
   * Get TBC Pay channel account
   * TransactionChannels ID 2 = TBC Pay
   */
  async getTbcPayChannelAccount(): Promise<number> {
    const TBC_PAY_CHANNEL_ID = 2;

    this.logger.log(`   🔍 Searching for TBC Pay channel account...`);
    this.logger.log(`      Channel ID: ${TBC_PAY_CHANNEL_ID}`);

    const channelAccount = await this.prisma.transactionChannelAccounts.findFirst({
      where: {
        transactionChannelId: TBC_PAY_CHANNEL_ID,
        active: 1,
      },
    });

    if (!channelAccount) {
      this.logger.error(`      ❌ TBC Pay channel account not found`);
      this.logger.error(`      Please create in TransactionChannelAccounts table:`);
      this.logger.error(`         transactionChannelId: ${TBC_PAY_CHANNEL_ID}`);
      this.logger.error(`         active: 1`);
      throw new Error('TBC Pay channel account not configured. Please set up in admin panel.');
    }

    this.logger.log(`      ✓ Found channel account: ID=${channelAccount.id}, Name=${channelAccount.name}`);
    return channelAccount.id;
  }

  /**
   * Log TBC Pay transaction for audit trail
   */
  async logTbcPayTransaction(params: LogTbcPayTransactionParams): Promise<void> {
    try {
      this.logger.log(`      📝 Creating TbcPayTransaction record...`);
      this.logger.log(`         TxnId: ${params.txnId}`);
      this.logger.log(`         Command: ${params.command}`);
      this.logger.log(`         CaseId: ${params.caseId}`);
      this.logger.log(`         ResultCode: ${params.resultCode}`);
      this.logger.log(`         TransactionId: ${params.transactionId || 'none'}`);

      await this.prisma.tbcPayTransaction.create({
        data: {
          txnId: params.txnId,
          command: params.command,
          caseId: params.caseId,
          personalId: params.personalId,
          sum: params.sum,
          resultCode: params.resultCode,
          resultMessage: params.resultMessage,
          ipAddress: params.ipAddress,
          transactionId: params.transactionId,
          requestData: params.requestData,
          responseData: params.responseData,
        },
      });

      this.logger.log(`      ✓ TbcPayTransaction created successfully`);
    } catch (error) {
      this.logger.error(`      ❌ Error logging TBC Pay transaction:`, error);
      this.logger.error(`         TxnId: ${params.txnId}`);
      this.logger.error(`         Error: ${error.message}`);
      // Don't throw - logging failure shouldn't break the payment
    }
  }

  /**
   * Check if transaction with this txn_id already exists
   */
  async checkDuplicateTransaction(txnId: string): Promise<boolean> {
    try {
      this.logger.log(`      🔍 Checking for duplicate transaction...`);
      this.logger.log(`         TxnId: ${txnId}`);

      const existing = await this.prisma.tbcPayTransaction.findUnique({
        where: { txnId },
      });

      const isDuplicate = !!existing;
      this.logger.log(`      ${isDuplicate ? '⚠️ DUPLICATE FOUND' : '✓ UNIQUE'}`);
      if (isDuplicate) {
        this.logger.log(`         Existing record ID: ${existing.id}`);
        this.logger.log(`         Created at: ${existing.createdAt}`);
      }

      return isDuplicate;
    } catch (error) {
      this.logger.error(`      ❌ Error checking duplicate transaction:`, error);
      this.logger.error(`         TxnId: ${txnId}`);
      this.logger.error(`         Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find loan by case ID
   * Returns loan with debtor and debt amount
   */
  async findLoanByCaseId(caseId: string): Promise<FindLoanByCaseIdResult> {
    try {
      this.logger.log(`      🔍 Searching for loan...`);
      this.logger.log(`         CaseId: ${caseId}`);
      this.logger.log(`         Filters: deletedAt=null, statusId NOT IN CLOSED`);

      const loan = await this.prisma.loan.findFirst({
        where: {
          caseId: caseId,
          deletedAt: null,
          statusId: { notIn: LoanStatusGroups.CLOSED as any }
        },
        include: {
          Debtor: {
            select: {
              idNumber: true,
              firstName: true,
              lastName: true,
            }
          },
          LoanRemaining: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!loan) {
        this.logger.log(`      ❌ Loan not found or closed`);
        this.logger.log(`         CaseId: ${caseId}`);
        return {
          success: false,
          error: 'Loan not found or closed',
        };
      }

      this.logger.log(`      ✓ Loan found`);
      this.logger.log(`         Loan ID: ${loan.id}`);
      this.logger.log(`         Status ID: ${loan.statusId}`);
      this.logger.log(`         Debtor: ${loan.Debtor.firstName} ${loan.Debtor.lastName}`);

      const currentDebt = loan.LoanRemaining[0];
      if (!currentDebt) {
        this.logger.error(`      ❌ LoanRemaining not found`);
        this.logger.error(`         Loan ID: ${loan.id}`);
        return {
          success: false,
          error: 'Loan balance not found',
        };
      }

      this.logger.log(`      ✓ LoanRemaining found`);
      this.logger.log(`         AgreementMin: ${currentDebt.agreementMin}`);
      this.logger.log(`         CurrentDebt: ${currentDebt.currentDebt}`);

      // Use agreementMin if exists, otherwise use currentDebt
      const debt = currentDebt.agreementMin && Number(currentDebt.agreementMin) > 0
        ? Number(currentDebt.agreementMin)
        : Number(currentDebt.currentDebt);

      this.logger.log(`      💰 Calculated debt: ${debt}`);
      this.logger.log(`         Using: ${debt === Number(currentDebt.agreementMin) ? 'agreementMin' : 'currentDebt'}`);

      return {
        success: true,
        loan,
        debtor: loan.Debtor,
        debt,
      };

    } catch (error) {
      this.logger.error(`      ❌ Database error finding loan:`, error);
      this.logger.error(`         CaseId: ${caseId}`);
      this.logger.error(`         Error: ${error.message}`);
      return {
        success: false,
        error: 'Database error',
      };
    }
  }

  /**
   * Process online payment (TBC Pay, etc.)
   * Reuses same payment allocation logic as manual payments
   */
  async processOnlinePayment(params: ProcessOnlinePaymentParams): Promise<ProcessOnlinePaymentResult> {
    try {
      // Get loan with status
      const loan = await this.prisma.loan.findUnique({
        where: { id: params.loanId },
        include: { LoanStatus: true },
      });

      if (!loan) {
        return { success: false, error: 'Loan not found' };
      }

      // Get loan remaining balance
      let loanRemaining = await this.prisma.loanRemaining.findFirst({
        where: { loanId: loan.id, deletedAt: null },
      });

      if (!loanRemaining) {
        return { success: false, error: 'Loan balance not found' };
      }

      // Currency rate (online payments are always in GEL for now)
      const currencyRate = 1;
      const paymentDate = new Date();

      // Process payment in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Handle overpayment scenario
        if (params.amount > Number(loanRemaining.currentDebt)) {
          const remainingAmount = params.amount - Number(loanRemaining.currentDebt);
          await tx.loanRemaining.update({
            where: { id: loanRemaining.id },
            data: { deletedAt: new Date() },
          });
          await tx.loanRemaining.create({
            data: {
              loanId: loan.id,
              principal: loanRemaining.principal,
              interest: loanRemaining.interest,
              penalty: Number(loanRemaining.penalty) + remainingAmount,
              otherFee: loanRemaining.otherFee,
              legalCharges: loanRemaining.legalCharges,
              currentDebt: Number(loanRemaining.currentDebt) + remainingAmount,
              agreementMin: loanRemaining.agreementMin,
            },
          });
          loanRemaining = await tx.loanRemaining.findFirst({
            where: { loanId: loan.id, deletedAt: null },
          });
        }

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            loanId: loan.id,
            amount: params.amount,
            currency: loan.currency,
            rate: currencyRate,
            paymentDate: paymentDate,
            transactionChannelAccountId: params.channelAccountId,
            publicId: randomUUID(),
            userId: null, // Automated payment, no user
            principal: 0,
            interest: 0,
            penalty: 0,
            fees: 0,
            legal: 0,
            comment: params.comment || `TBC Pay: ${params.txnId}`,
          },
        });

        // Allocate payment using payment helper
        const allocationResult = await this.paymentsHelper.allocatePayment(
          transaction.id,
          'PAYMENT',
          params.amount,
          loanRemaining,
          tx
        );

        // Update transaction summary
        await this.paymentsHelper.updateTransactionSummary(
          transaction.id,
          allocationResult.transactionSummary,
          tx
        );

        // Update loan remaining
        await this.paymentsHelper.updateLoanRemaining(
          loanRemaining.id,
          allocationResult.newBalances,
          allocationResult.newCurrentDebt,
          loanRemaining,
          tx
        );

        // Create balance history
        await this.paymentsHelper.createBalanceHistory(
          loan.id,
          transaction.id,
          allocationResult.newBalances,
          allocationResult.newCurrentDebt,
          'PAYMENT',
          tx
        );

        // Update loan status if fully paid
        if (Number(allocationResult.newCurrentDebt) === 0) {
          const oldStatusId = loan.statusId;

          await tx.loan.update({
            where: { id: loan.id },
            data: {
              statusId: 12, // Closed status
              closedAt: new Date(),
            },
          });

          await tx.loanStatusHistory.create({
            data: {
              loanId: loan.id,
              oldStatusId: oldStatusId,
              newStatusId: 12,
              changedBy: 56, // Automated payment
              notes: `Automatically closed via TBC Pay (txn_id: ${params.txnId})`,
            },
          });
        }

        return { transactionId: transaction.id };
      });

      return {
        success: true,
        transactionId: result.transactionId,
      };

    } catch (error) {
      this.logger.error('Error processing online payment:', error);
      return {
        success: false,
        error: 'Payment processing failed',
      };
    }
  }

}
