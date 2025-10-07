import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getScheduledVisits, markSchedulesAsOverdue, updateVisitsToNA, agreementsToCancel, cancelCommitment, cancelSchedules, cancelLoan } from '../helpers/loan.helper';
import { statusToId } from 'src/enums/visitStatus.enum';
import { getStartOfDay, getTodayAtMidnight, subtractDays } from 'src/helpers/date.helper';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) { }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs every day at 00:00
  async incrementLoanActDay() {
    try {
      this.logger.log('Starting daily loan actDay increment...');

      // Update all loans: increment actDay by 1
      const result = await this.prisma.loan.updateMany({
        data: {
          actDays: {
            increment: 1
          }
        }
      });

      this.logger.log(`Successfully incremented actDay for ${result.count} loans`);
    } catch (error) {
      this.logger.error('Error incrementing loan actDay:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs every day at 00:00
  async updateLoanVisitStatus() {
    try {
      this.logger.log('Starting loan visit status update...');

      // Get visits that were scheduled 30+ days ago
      const visits = await getScheduledVisits(this.prisma, 30);

      if (visits.length > 0) {
        for (const visit of visits) {
          // Check StatusMatrix - is this transition allowed?
          const isTransitionAllowed = await this.prisma.statusMatrixAutomatic.findFirst({
            where: {
              entityType: 'LOAN_VISIT',
              fromStatusId: statusToId[visit.status],
              toStatusId: statusToId['n_a'],
              isActive: true,
              deletedAt: null,
            },
          });

          if (!isTransitionAllowed) {
            this.logger.log(`Status transition from ${visit.status} status to 'N/A' is not allowed`);
          }
        }

        const visitIds = visits.map(visit => visit.id);
        // Update visits to n_a status
        const updatedCount = await updateVisitsToNA(this.prisma, visitIds);
        this.logger.log(`Successfully updated ${updatedCount} visit statuses to n/a`);
      } else {
        this.logger.log('No visits found that need status update');
      }
    } catch (error) {
      this.logger.error('Error updating loan visit status:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs every day at 00:00
  async aggrementCancellation() {
    try {
      this.logger.log('Starting agreement cancellation...');

      const today = getTodayAtMidnight();
      const sixtyDaysAgo = subtractDays(today, 60);

      await markSchedulesAsOverdue(this.prisma, today);

      const agreementToCancel = await agreementsToCancel(this.prisma, sixtyDaysAgo);

      let cancelCount = 0;
      for (const commitment of agreementToCancel) {
        await this.prisma.$transaction(async (tx) => {
          await cancelCommitment(tx, commitment.id);

          // await cancelSchedules(tx, commitment.id);

          await cancelLoan(tx, commitment.loanId, 7);
        });
        cancelCount++;
      }

      this.logger.log(`Successfully cancelled ${cancelCount} agreements`);
    } catch (error) {
      this.logger.error('Error cancelling agreement:', error);
    }
  }
  // @Cron('* * * * *') // Runs every minute
  // @Cron('30 * * * * *') // Runs every 30 seconds
  // async testCron() {
  //   this.logger.log('Test cron job running every minute...');
  // }
}
