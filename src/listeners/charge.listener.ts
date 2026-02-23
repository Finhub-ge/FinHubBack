import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ChargeCreatedEvent,
  ChargeDeletedEvent,
  ErrorProcessingFailedEvent,
} from 'src/events/events.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChargeEventListener {
  private readonly logger = new Logger(ChargeEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('charge.created', { async: true })
  async handleChargeCreated(event: ChargeCreatedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Charge ${event.chargeId}] Starting background processing for charge creation`,
    );

    try {
      // STEP 1: Create PaymentAllocationDetail
      await this.prisma.paymentAllocationDetail.create({
        data: {
          loanId: event.loanId,
          sourceType: event.sourceType,
          sourceId: event.chargeId,
          componentType: event.componentType,
          amountAllocated: Number(event.amount || 0),
          balanceBefore: event.isLegalCharge
            ? Number(event.oldBalances.legalCharges)
            : Number(event.oldBalances.otherFee),
          balanceAfter: event.isLegalCharge
            ? Number(event.newBalances.legalCharges)
            : Number(event.newBalances.otherFee),
          allocationOrder: 1,
        },
      });

      this.logger.log(
        `[Charge ${event.chargeId}] Created payment allocation detail`,
      );

      // STEP 2: Create LoanBalanceHistory
      await this.prisma.loanBalanceHistory.create({
        data: {
          loanId: event.loanId,
          principal: event.newBalances.principal,
          interest: event.newBalances.interest,
          penalty: event.newBalances.penalty,
          otherFee: event.newBalances.otherFee,
          legalCharges: event.newBalances.legalCharges,
          totalDebt: event.newCurrentDebt,
          sourceType: event.sourceType,
          sourceId: event.chargeId,
        },
      });

      this.logger.log(
        `[Charge ${event.chargeId}] Created loan balance history`,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Charge ${event.chargeId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Charge ${event.chargeId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'charge_creation_background_processing',
        context: `Charge ${event.chargeId} creation failed`,
        additionalInfo: {
          chargeId: event.chargeId,
          loanId: event.loanId,
          sourceType: event.sourceType,
          componentType: event.componentType,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }

  @OnEvent('charge.deleted', { async: true })
  async handleChargeDeleted(event: ChargeDeletedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Charge ${event.chargeId}] Starting background processing for charge deletion`,
    );

    try {
      // STEP 1: Soft delete old PaymentAllocationDetail (if exists)
      if (event.oldAllocationDetailId) {
        await this.prisma.paymentAllocationDetail.update({
          where: { id: event.oldAllocationDetailId },
          data: { deletedAt: new Date() },
        });

        this.logger.log(
          `[Charge ${event.chargeId}] Soft deleted old payment allocation detail`,
        );
      }

      // STEP 2: Create new PaymentAllocationDetail for deletion (audit trail)
      await this.prisma.paymentAllocationDetail.create({
        data: {
          loanId: event.loanId,
          sourceType: event.deletionSourceType,
          sourceId: event.chargeId,
          componentType: event.componentType,
          amountAllocated: -Number(event.amount),
          balanceBefore: event.isLegalCharge
            ? Number(event.oldBalances.legalCharges)
            : Number(event.oldBalances.otherFee),
          balanceAfter: event.isLegalCharge
            ? Number(event.newBalances.legalCharges)
            : Number(event.newBalances.otherFee),
          allocationOrder: 1,
        },
      });

      this.logger.log(
        `[Charge ${event.chargeId}] Created payment allocation detail for deletion`,
      );

      // STEP 3: Soft delete old LoanBalanceHistory (if exists)
      if (event.oldBalanceHistoryId) {
        await this.prisma.loanBalanceHistory.update({
          where: { id: event.oldBalanceHistoryId },
          data: { deletedAt: new Date() },
        });

        this.logger.log(
          `[Charge ${event.chargeId}] Soft deleted old loan balance history`,
        );
      }

      // STEP 4: Create new LoanBalanceHistory for deletion (audit trail)
      await this.prisma.loanBalanceHistory.create({
        data: {
          loanId: event.loanId,
          principal: event.newBalances.principal,
          interest: event.newBalances.interest,
          penalty: event.newBalances.penalty,
          otherFee: event.newBalances.otherFee,
          legalCharges: event.newBalances.legalCharges,
          totalDebt: event.newCurrentDebt,
          sourceType: event.deletionSourceType,
          sourceId: event.chargeId,
        },
      });

      this.logger.log(
        `[Charge ${event.chargeId}] Created loan balance history for deletion`,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Charge ${event.chargeId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Charge ${event.chargeId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'charge_deletion_background_processing',
        context: `Charge ${event.chargeId} deletion failed`,
        additionalInfo: {
          chargeId: event.chargeId,
          loanId: event.loanId,
          sourceType: event.deletionSourceType,
          componentType: event.componentType,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }
}
