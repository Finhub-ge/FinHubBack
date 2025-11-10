import { Injectable } from '@nestjs/common';
import { GetPlanChartDto } from './dto/getPlanChart.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
  ) { }
  async getPlanChart(getPlanChartDto: GetPlanChartDto) {
    const { collectorId, month, year } = getPlanChartDto;

    // Build Prisma where clause
    const where: any = {};
    if (year && year.length > 0) where.year = { in: year };
    if (month && month.length > 0) where.month = { in: month };
    if (collectorId && collectorId.length > 0) where.collectorId = { in: collectorId };

    // Fetch targets matching filters
    const targets = await this.prisma.collectorsMonthlyTarget.findMany({
      where,
      select: {
        targetAmount: true,
        month: true,
        collectorId: true,
      },
    });

    // Fetch actual collections / transactions
    // const collections = await this.prisma.transaction.findMany({
    //   where,
    //   select: {
    //     amount: true,
    //     paymentDate: true
    //   },
    // });

    // Initialize 12-month arrays
    const targetAmounts = Array(12).fill(0);
    const collectedAmounts = Array(12).fill(0); // for now all zeros
    // const userIds = new Set<number>();

    // Sum targets
    targets.forEach(t => {
      targetAmounts[t.month - 1] += Number(t.targetAmount);
    });

    // Sum collections per month
    // collections.forEach(c => {
    //   collectedAmounts[c.paymentDate.getMonth()] += Number(c.amount);
    // });

    return {
      // userIds: Array.from(userIds),
      targetAmounts,
      collectedAmounts,
    };
  }
}
