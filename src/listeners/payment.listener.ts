import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import {
  PaymentTransactionCreatedEvent,
  ErrorProcessingFailedEvent,
  TransactionDeletedEvent
} from 'src/events/events.interface';

@Injectable()
export class PaymentEventListener {
  private readonly logger = new Logger(PaymentEventListener.name);

  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper,
    private eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('payment.transaction.created', { async: true })
  async handlePaymentTransactionCreated(event: PaymentTransactionCreatedEvent) {
    const startTime = Date.now();
    this.logger.log(`[Payment ${event.transactionId}] Starting background processing`);

    try {
      // STEP 1: Update loan remaining
      await this.updateLoanRemaining(event);
      this.logger.debug(`[Payment ${event.transactionId}] Loan remaining updated`);

      // STEP 2: Create balance history
      await this.createBalanceHistory(event);
      this.logger.debug(`[Payment ${event.transactionId}] Balance history created`);

      // STEP 3: Apply payment to schedule (if Agreement)
      if (event.loanStatusName === 'Agreement') {
        await this.applyPaymentToSchedule(event);
        this.logger.debug(`[Payment ${event.transactionId}] Payment applied to schedule`);
      }

      // STEP 4: Update loan status if fully paid
      if (Number(event.allocationResult.newCurrentDebt) === 0) {
        await this.updateLoanStatusToClosed(event);
        this.logger.debug(`[Payment ${event.transactionId}] Loan status updated to closed`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`[Payment ${event.transactionId}] ✅ Background processing completed in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Payment ${event.transactionId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'payment_background_processing',
        context: `Payment ${event.transactionId} creation failed`,
        additionalInfo: {
          transactionId: event.transactionId,
          loanId: event.loanId,
          amount: event.amount,
          paymentDate: event.paymentDate,
          userId: event.userId,
          loanRemainingId: event.loanRemainingId,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
      // Don't throw - payment already created successfully
    }
  }

  @OnEvent('transaction.deleted', { async: true })
  async handleTransactionDeleted(event: TransactionDeletedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Transaction ${event.transactionId}] Starting background processing for deletion`,
    );

    try {
      // STEP 1: Soft delete balance history (if exists)
      if (event.balanceHistoryId) {
        await this.prisma.loanBalanceHistory.update({
          where: { id: event.balanceHistoryId },
          data: { deletedAt: new Date() },
        });
        this.logger.log(
          `[Transaction ${event.transactionId}] Balance history soft deleted`,
        );
      }

      // STEP 2: Revert payment schedule (if Agreement status)
      const loan = await this.prisma.loan.findUnique({
        where: { id: event.loanId },
        include: { LoanStatus: true },
      });

      if (loan?.LoanStatus?.name === 'Agreement') {
        // Find schedules that were paid on this transaction's date
        const schedulesUpdated = await this.prisma.paymentSchedule.findMany({
          where: {
            PaymentCommitment: {
              loanId: event.loanId,
              type: 'agreement',
              isActive: 1,
              deletedAt: null,
            },
            paidDate: event.paymentDate,
            deletedAt: null,
          },
        });

        // Reverse payment application to schedules
        let amountToReverse = event.amount;

        for (const schedule of schedulesUpdated.reverse()) {
          if (amountToReverse <= 0) break;

          const currentPaid = Number(schedule.paidAmount || 0);
          const totalScheduled = Number(schedule.amount);
          const amountToReduceFromSchedule = Math.min(amountToReverse, currentPaid);
          const newPaidAmount = currentPaid - amountToReduceFromSchedule;

          // Determine new status
          let newStatus = 'PENDING';
          if (newPaidAmount > 0 && newPaidAmount < totalScheduled) {
            newStatus = 'PARTIAL';
          } else if (newPaidAmount >= totalScheduled) {
            newStatus = 'PAID';
          }

          await this.prisma.paymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
              paidDate: newStatus === 'PAID' ? schedule.paidDate : null,
            },
          });

          amountToReverse -= amountToReduceFromSchedule;
        }

        this.logger.log(
          `[Transaction ${event.transactionId}] Payment schedule reverted (${schedulesUpdated.length} schedules updated)`,
        );
      }

      // STEP 3: Revert loan status (if was closed by this payment)
      if (event.closingStatusHistoryId && event.oldLoanStatusId) {
        // Soft delete the closing status history entry
        await this.prisma.loanStatusHistory.update({
          where: { id: event.closingStatusHistoryId },
          data: { deletedAt: new Date() },
        });

        // Revert loan status to previous status
        await this.prisma.loan.update({
          where: { id: event.loanId },
          data: { statusId: event.oldLoanStatusId },
        });

        this.logger.log(
          `[Transaction ${event.transactionId}] Loan status reverted from Closed to ${event.loanStatusName}`,
        );
      }

      // STEP 5: Create transaction deletion record
      await this.prisma.transactionDeleted.create({
        data: {
          transactionId: event.transactionId,
          userId: event.userId,
          deletedAt: new Date()
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Transaction ${event.transactionId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Transaction ${event.transactionId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'transaction_deletion_background_processing',
        context: `Transaction ${event.transactionId} deletion failed`,
        additionalInfo: {
          transactionId: event.transactionId,
          loanId: event.loanId,
          amount: event.amount,
          paymentDate: event.paymentDate,
          userId: event.userId,
          loanRemainingId: event.loanRemainingId,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }

  private async updateLoanRemaining(event: PaymentTransactionCreatedEvent) {
    // Soft delete old loan remaining
    await this.prisma.loanRemaining.update({
      where: { id: event.loanRemainingId },
      data: { deletedAt: new Date() },
    });

    // Create new loan remaining with updated balances
    await this.prisma.loanRemaining.create({
      data: {
        loanId: event.loanId,
        principal: event.allocationResult.newBalances.principal,
        interest: event.allocationResult.newBalances.interest,
        penalty: event.allocationResult.newBalances.penalty,
        otherFee: event.allocationResult.newBalances.otherFee,
        legalCharges: event.allocationResult.newBalances.legalCharges,
        currentDebt: event.allocationResult.newCurrentDebt,
        agreementMin: event.agreementMin,
      },
    });
  }

  private async createBalanceHistory(event: PaymentTransactionCreatedEvent) {
    await this.prisma.loanBalanceHistory.create({
      data: {
        loanId: event.loanId,
        sourceId: event.transactionId,
        principal: event.allocationResult.newBalances.principal,
        interest: event.allocationResult.newBalances.interest,
        penalty: event.allocationResult.newBalances.penalty,
        otherFee: event.allocationResult.newBalances.otherFee,
        legalCharges: event.allocationResult.newBalances.legalCharges,
        totalDebt: event.allocationResult.newCurrentDebt,
        sourceType: 'PAYMENT',
      },
    });
  }

  private async applyPaymentToSchedule(event: PaymentTransactionCreatedEvent) {
    await this.paymentHelper.applyPaymentToSchedule(
      event.loanId,
      event.amount,
      event.paymentDate.toISOString(),
      this.prisma,
    );
  }

  private async updateLoanStatusToClosed(event: PaymentTransactionCreatedEvent) {
    // Update loan status
    await this.prisma.loan.update({
      where: { id: event.loanId },
      data: {
        statusId: 12, // Closed
        closedAt: new Date(),
      },
    });

    // Create loan status history
    await this.prisma.loanStatusHistory.create({
      data: {
        loanId: event.loanId,
        oldStatusId: event.oldLoanStatus,
        newStatusId: 12,
        changedBy: event.userId,
        notes: 'Automatically updated to Closed (paid) - loan balance reached 0',
      },
    });
  }
}
