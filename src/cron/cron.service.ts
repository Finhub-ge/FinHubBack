import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getScheduledVisits, updateVisitsToNA } from '../helpers/loan.helper';

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
      const visitIds = await getScheduledVisits(this.prisma, 30);

      if (visitIds.length > 0) {
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
  // @Cron('* * * * *') // Runs every minute
  // async testCron() {
  //   this.logger.log('Test cron job running every minute...');
  // }
}
