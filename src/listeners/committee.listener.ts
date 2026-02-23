import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CommitteeRespondedEvent,
  ErrorProcessingFailedEvent,
} from 'src/events/events.interface';
import { PrismaService } from '../prisma/prisma.service';
import { Committee_type } from '@prisma/client';
import { logAssignmentHistory, updateLoanRemaining } from 'src/helpers/loan.helper';

@Injectable()
export class CommitteeEventListener {
  private readonly logger = new Logger(CommitteeEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('committee.responded', { async: true })
  async handleCommitteeResponded(event: CommitteeRespondedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Committee ${event.committeeId}] Starting background processing for ${event.committeeType} type`,
    );

    try {
      const currentRemaining = await this.prisma.loanRemaining.findFirst({
        where: {
          id: event.currentLoanRemainingId,
          deletedAt: null,
        },
      });

      if (!currentRemaining) {
        throw new Error('Current loan remaining not found');
      }

      // STEP 1: Handle hopeless type
      if (event.committeeType === Committee_type.hopeless) {
        this.logger.log(
          `[Committee ${event.committeeId}] Processing hopeless committee`,
        );

        // Update loan groupId to 14
        await this.prisma.loan.update({
          where: { id: event.loanId },
          data: { groupId: 14 },
        });

        this.logger.log(
          `[Committee ${event.committeeId}] Updated loan groupId to 14`,
        );

        // If not already assigned to target user, reassign
        if (event.currentAssignmentUserId !== event.targetUserId) {
          // Deactivate current assignment if exists
          if (event.currentAssignmentUserId) {
            const currentAssignment = await this.prisma.loanAssignment.findFirst({
              where: {
                loanId: event.loanId,
                userId: event.currentAssignmentUserId,
                roleId: event.targetUserRoleId,
                isActive: true,
              },
            });

            if (currentAssignment) {
              await this.prisma.loanAssignment.update({
                where: { id: currentAssignment.id },
                data: { isActive: false, unassignedAt: new Date() },
              });

              // Log unassignment
              await logAssignmentHistory({
                prisma: this.prisma as any,
                loanId: event.loanId,
                userId: event.currentAssignmentUserId,
                roleId: event.targetUserRoleId,
                action: 'unassigned',
                assignedBy: event.userId,
              });

              this.logger.log(
                `[Committee ${event.committeeId}] Unassigned from user ${event.currentAssignmentUserId}`,
              );
            }
          }

          // Create new assignment to target user
          await this.prisma.loanAssignment.create({
            data: {
              loanId: event.loanId,
              userId: event.targetUserId,
              roleId: event.targetUserRoleId,
              isActive: true,
            },
          });

          // Log new assignment
          await logAssignmentHistory({
            prisma: this.prisma as any,
            loanId: event.loanId,
            userId: event.targetUserId,
            roleId: event.targetUserRoleId,
            action: 'assigned',
            assignedBy: event.userId,
          });

          this.logger.log(
            `[Committee ${event.committeeId}] Assigned to user ${event.targetUserId}`,
          );

          // Create comment for hopeless reassignment
          await this.prisma.comments.create({
            data: {
              loanId: event.loanId,
              userId: event.userId,
              comment: `Hopeless case - Reassigned to ${event.targetUserName} (${event.targetUserId}) and moved to group 14`,
            },
          });

          this.logger.log(
            `[Committee ${event.committeeId}] Created reassignment comment`,
          );
        }

        // Update loan remaining with agreement min
        if (event.agreementMinAmount !== null) {
          await updateLoanRemaining(
            this.prisma as any,
            currentRemaining,
            event.agreementMinAmount,
          );

          this.logger.log(
            `[Committee ${event.committeeId}] Updated loan remaining with agreementMin`,
          );
        }
      }

      // STEP 2: Handle close type
      if (event.committeeType === Committee_type.close) {
        this.logger.log(
          `[Committee ${event.committeeId}] Processing close committee`,
        );

        // Soft delete current loan remaining
        await this.prisma.loanRemaining.update({
          where: { id: currentRemaining.id },
          data: { deletedAt: new Date() },
        });

        // Create new loan remaining with all zeros
        await this.prisma.loanRemaining.create({
          data: {
            loanId: event.loanId,
            principal: 0,
            interest: 0,
            penalty: 0,
            otherFee: 0,
            legalCharges: 0,
            currentDebt: 0,
            agreementMin: 0,
          },
        });

        this.logger.log(
          `[Committee ${event.committeeId}] Zeroed out loan balances`,
        );

        // Update loan status to 12 (Closed)
        await this.prisma.loan.update({
          where: { id: event.loanId },
          data: { statusId: 12, closedAt: new Date(), updatedAt: new Date() },
        });

        this.logger.log(
          `[Committee ${event.committeeId}] Updated loan status to Closed`,
        );

        // Create loan status history
        await this.prisma.loanStatusHistory.create({
          data: {
            loanId: event.loanId,
            oldStatusId: event.oldLoanStatusId,
            newStatusId: 12,
            changedBy: event.userId,
            notes: 'Committee closed the case',
          },
        });

        this.logger.log(
          `[Committee ${event.committeeId}] Created status history`,
        );
      }

      // STEP 3: Handle other types (update loan remaining only)
      if (
        event.committeeType !== Committee_type.close &&
        event.committeeType !== Committee_type.hopeless &&
        event.agreementMinAmount !== null
      ) {
        await updateLoanRemaining(
          this.prisma as any,
          currentRemaining,
          event.agreementMinAmount,
        );

        this.logger.log(
          `[Committee ${event.committeeId}] Updated loan remaining for ${event.committeeType} type`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Committee ${event.committeeId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Committee ${event.committeeId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'committee_response_background_processing',
        context: `Committee ${event.committeeId} response failed`,
        additionalInfo: {
          committeeId: event.committeeId,
          loanId: event.loanId,
          committeeType: event.committeeType,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }
}
