import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoanStatusUpdatedEvent, PaymentProcessingFailedEvent } from '../events/payment.events';
import { PrismaService } from '../prisma/prisma.service';
import { Reminders_type } from '@prisma/client';
import { saveScheduleReminders } from 'src/helpers/loan.helper';

@Injectable()
export class LoanStatusBackgroundListener {
  private readonly logger = new Logger(LoanStatusBackgroundListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('loan.status.updated', { async: true })
  async handleLoanStatusUpdated(event: LoanStatusUpdatedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[LoanStatus ${event.loanId}] Starting background processing for status change to ${event.newStatusName}`,
    );

    try {
      // STEP 1: Update related debtor loans (if needed)
      if (event.shouldUpdateAllLoans && event.debtorLoans.length > 0) {
        this.logger.log(
          `[LoanStatus ${event.loanId}] Updating ${event.debtorLoans.length} related debtor loans`,
        );

        // Create history records for all other loans
        const historyRecords = event.debtorLoans.map((debtorLoan) => ({
          loanId: debtorLoan.id,
          oldStatusId: debtorLoan.statusId,
          newStatusId: event.newStatusId,
          changedBy: event.userId,
          notes: `Status changed from Case: ${event.loanCaseId}${event.comment ? `: ${event.comment}` : ''}`,
        }));

        await this.prisma.loanStatusHistory.createMany({
          data: historyRecords,
        });

        this.logger.log(
          `[LoanStatus ${event.loanId}] Created ${historyRecords.length} status history records`,
        );

        // Update all other debtor's loans with the new status and lastActivite
        const updateData: any = {
          statusId: event.newStatusId,
        };
        if (event.shouldUpdateLastActivity) {
          updateData.lastActivite = new Date();
        }

        await this.prisma.loan.updateMany({
          where: {
            publicId: { in: event.debtorLoans.map((l) => l.publicId) },
            deletedAt: null,
          },
          data: updateData,
        });

        this.logger.log(
          `[LoanStatus ${event.loanId}] Updated ${event.debtorLoans.length} related loans`,
        );
      }

      // STEP 2: Handle Agreement status reminders
      if (event.newStatusName === 'Agreement' && event.commitmentId) {
        await saveScheduleReminders(
          {
            loanId: event.loanId,
            commitmentId: event.commitmentId,
            userId: event.userId,
            type: Reminders_type.Agreement,
          },
          this.prisma,
        );

        this.logger.log(
          `[LoanStatus ${event.loanId}] Created Agreement reminders`,
        );
      }

      // STEP 3: Handle Promise status reminders
      if (event.newStatusName === 'Promised To Pay' && event.commitmentId) {
        await saveScheduleReminders(
          {
            loanId: event.loanId,
            commitmentId: event.commitmentId,
            userId: event.userId,
            type: Reminders_type.Promised_to_pay,
          },
          this.prisma,
        );

        this.logger.log(
          `[LoanStatus ${event.loanId}] Created Promise reminders`,
        );
      }

      // STEP 4: Handle Agreement Canceled status
      if (event.newStatusName === 'Agreement Canceled') {
        // Deactivate commitments
        await this.prisma.paymentCommitment.updateMany({
          where: { loanId: event.loanId, isActive: 1 },
          data: { isActive: 0 },
        });

        // Deactivate reminders
        await this.prisma.reminders.updateMany({
          where: {
            loanId: event.loanId,
            type: Reminders_type.Agreement,
            status: true,
          },
          data: { status: false },
        });

        this.logger.log(
          `[LoanStatus ${event.loanId}] Deactivated commitments and reminders`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[LoanStatus ${event.loanId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[LoanStatus ${event.loanId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: PaymentProcessingFailedEvent = {
        transactionId: event.loanId,
        step: 'loan_status_background_processing',
        error: error.message,
        timestamp: new Date(),
      };
      this.eventEmitter.emit('payment.processing.failed', failureEvent);
    }
  }
}
