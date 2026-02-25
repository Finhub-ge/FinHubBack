import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MonthlyTargetCreatedEvent,
  MonthlyTargetUpdatedEvent,
  ErrorProcessingFailedEvent,
} from 'src/events/events.interface';

@Injectable()
export class PlanTargetEventListener {
  private readonly logger = new Logger(PlanTargetEventListener.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('plan.target.created', { async: true })
  async handleTargetCreated(event: MonthlyTargetCreatedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Target ${event.targetId}] Syncing junction table for ${event.loanIds.length} loans`,
    );

    try {
      await this.syncJunctionTable(
        event.targetId,
        event.loanIds,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Target ${event.targetId}] ✅ Junction table synced in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Target ${event.targetId}] ❌ Junction table sync failed after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'plan_target_created_background_processing',
        context: `Target ${event.targetId} junction table sync failed`,
        additionalInfo: {
          targetId: event.targetId,
          collectorId: event.collectorId,
          year: event.year,
          month: event.month,
          loanCount: event.loanIds.length,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }

  @OnEvent('plan.target.updated', { async: true })
  async handleTargetUpdated(event: MonthlyTargetUpdatedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Target ${event.targetId}] Updating junction table for ${event.loanIds.length} loans`,
    );

    try {
      // Delete existing records
      await this.prisma.collectorMonthlyTargetLoan.deleteMany({
        where: { monthlyTargetId: event.targetId },
      });

      // Insert new records
      await this.syncJunctionTable(
        event.targetId,
        event.loanIds,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Target ${event.targetId}] ✅ Junction table updated in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Target ${event.targetId}] ❌ Junction table update failed after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'plan_target_updated_background_processing',
        context: `Target ${event.targetId} junction table update failed`,
        additionalInfo: {
          targetId: event.targetId,
          collectorId: event.collectorId,
          year: event.year,
          month: event.month,
          loanCount: event.loanIds.length,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }

  private async syncJunctionTable(
    targetId: number,
    loanIds: number[],
  ) {
    if (loanIds.length === 0) return;

    // Batch insert in chunks to avoid large queries
    const BATCH_SIZE = 1000;
    for (let i = 0; i < loanIds.length; i += BATCH_SIZE) {
      const batch = loanIds.slice(i, i + BATCH_SIZE);

      await this.prisma.collectorMonthlyTargetLoan.createMany({
        data: batch.map((loanId) => ({
          monthlyTargetId: targetId,
          loanId: loanId,
        })),
        skipDuplicates: true,
      });
    }
  }
}
