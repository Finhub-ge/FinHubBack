import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentCreatedEvent, ErrorProcessingFailedEvent } from 'src/events/events.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentEventListener {
  private readonly logger = new Logger(CommentEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @OnEvent('comment.created', { async: true })
  async handleCommentCreated(event: CommentCreatedEvent) {
    const startTime = Date.now();
    this.logger.log(
      `[Comment ${event.commentId}] Starting background processing for comment on loan ${event.loanCaseId}`,
    );

    try {
      // STEP 1: Get all other loans for this debtor
      const debtorLoans = await this.prisma.loan.findMany({
        where: {
          debtorId: event.debtorId,
          deletedAt: null,
          id: { not: event.loanId }, // Exclude current loan
        },
        select: {
          id: true,
          caseId: true,
        },
      });

      this.logger.log(
        `[Comment ${event.commentId}] Found ${debtorLoans.length} related debtor loans`,
      );

      // STEP 2: Create comments for all related loans with prefix
      if (debtorLoans.length > 0) {
        const relatedComments = debtorLoans.map((relatedLoan) => ({
          loanId: relatedLoan.id,
          userId: event.userId,
          comment: `From case: ${event.loanCaseId} ${event.comment}`,
          uploadId: event.uploadId,
        }));

        await this.prisma.comments.createMany({
          data: relatedComments,
        });

        this.logger.log(
          `[Comment ${event.commentId}] Created ${debtorLoans.length} related comments`,
        );
      }

      // STEP 3: Update lastActivite for the main loan (if needed)
      if (event.shouldUpdateLastActivity) {
        await this.prisma.loan.update({
          where: { id: event.loanId },
          data: {
            actDays: 0,
            lastActivite: new Date(),
          },
        });

        this.logger.log(
          `[Comment ${event.commentId}] Updated lastActivite for main loan`,
        );

        // STEP 4: Update lastActivite for all related loans (if needed)
        if (debtorLoans.length > 0) {
          await this.prisma.loan.updateMany({
            where: {
              id: { in: debtorLoans.map((l) => l.id) },
              deletedAt: null,
            },
            data: {
              actDays: 0,
              lastActivite: new Date(),
            },
          });

          this.logger.log(
            `[Comment ${event.commentId}] Updated lastActivite for ${debtorLoans.length} related loans`,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Comment ${event.commentId}] ✅ Background processing completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[Comment ${event.commentId}] ❌ Background processing failed after ${duration}ms: ${error.message}`,
      );

      // Emit failure event for monitoring
      const failureEvent: ErrorProcessingFailedEvent = {
        error: error.message,
        timestamp: new Date(),
        source: 'comment_background_processing',
        context: `Comment ${event.commentId} creation failed`,
        additionalInfo: {
          commentId: event.commentId,
          loanId: event.loanId,
          loanCaseId: event.loanCaseId,
        },
      };
      this.eventEmitter.emit('error.processing.failed', failureEvent);
    }
  }
}
