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
   * TransactionChannels ID 4 = TBC Pay
   */
  async getTbcPayChannelAccount(): Promise<number> {
    const TBC_PAY_CHANNEL_ID = 4;

    const channelAccount = await this.prisma.transactionChannelAccounts.findFirst({
      where: {
        transactionChannelId: TBC_PAY_CHANNEL_ID,
        active: 1,
      },
    });

    if (!channelAccount) {
      throw new Error('TBC Pay channel account not configured. Please set up in admin panel.');
    }

    return channelAccount.id;
  }

  /**
   * Log TBC Pay transaction for audit trail
   */
  async logTbcPayTransaction(params: LogTbcPayTransactionParams): Promise<void> {
    try {
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
        },
      });
    } catch (error) {
      this.logger.error('Error logging TBC Pay transaction:', error);
      // Don't throw - logging failure shouldn't break the payment
    }
  }

  /**
   * Check if transaction with this txn_id already exists
   */
  async checkDuplicateTransaction(txnId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.tbcPayTransaction.findUnique({
        where: { txnId },
      });

      return !!existing;
    } catch (error) {
      this.logger.error('Error checking duplicate transaction:', error);
      throw error;
    }
  }

  /**
   * Find loan by case ID
   * Returns loan with debtor and debt amount
   */
  async findLoanByCaseId(caseId: string): Promise<FindLoanByCaseIdResult> {
    try {
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
        return {
          success: false,
          error: 'Loan not found or closed',
        };
      }

      const currentDebt = loan.LoanRemaining[0];
      if (!currentDebt) {
        return {
          success: false,
          error: 'Loan balance not found',
        };
      }

      // Use agreementMin if exists, otherwise use currentDebt
      const debt = currentDebt.agreementMin && Number(currentDebt.agreementMin) > 0
        ? Number(currentDebt.agreementMin)
        : Number(currentDebt.currentDebt);

      return {
        success: true,
        loan,
        debtor: loan.Debtor,
        debt,
      };

    } catch (error) {
      this.logger.error('Error finding loan:', error);
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
              changedBy: null, // Automated payment
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
