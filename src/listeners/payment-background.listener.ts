import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import {
  PaymentTransactionCreatedEvent,
  PaymentProcessingFailedEvent
} from 'src/events/payment.events';

@Injectable()
export class PaymentBackgroundListener {
  private readonly logger = new Logger(PaymentBackgroundListener.name);

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
      this.eventEmitter.emit('payment.processing.failed', {
        transactionId: event.transactionId,
        step: 'background_processing',
        error: error.message,
        timestamp: new Date(),
      } as PaymentProcessingFailedEvent);

      // Don't throw - payment already created successfully
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
