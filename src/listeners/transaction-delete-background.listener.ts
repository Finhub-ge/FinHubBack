import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionDeletedEvent, PaymentProcessingFailedEvent } from '../events/payment.events';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionDeleteBackgroundListener {
  private readonly logger = new Logger(TransactionDeleteBackgroundListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

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
      const failureEvent: PaymentProcessingFailedEvent = {
        transactionId: event.transactionId,
        step: 'transaction_deletion_background_processing',
        error: error.message,
        timestamp: new Date(),
      };
      this.eventEmitter.emit('payment.processing.failed', failureEvent);
    }
  }
}
