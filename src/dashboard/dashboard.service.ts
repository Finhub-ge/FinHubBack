import { Injectable } from '@nestjs/common';
import { GetPlanChartDto } from './dto/getPlanChart.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Role } from 'src/enums/role.enum';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
  ) { }
  async getPlanChart(getPlanChartDto: GetPlanChartDto) {
    const { collectorId, year } = getPlanChartDto;

    // Build Prisma where clause
    const where: any = {};
    if (year && year.length > 0) where.year = { in: year };
    // if (month && month.length > 0) where.month = { in: month };

    const targetWhere: any = { ...where };
    if (collectorId && collectorId.length > 0) targetWhere.collectorId = { in: collectorId };

    // Fetch targets matching filters
    const targets = await this.prisma.collectorsMonthlyTarget.findMany({
      where: targetWhere,
      select: {
        targetAmount: true,
        month: true,
        year: true,
        collectorId: true,
      },
    });

    const collectionWhere: any = {
      ...where,
      roleId: 7,
    };
    if (collectorId?.length) collectionWhere.userId = { in: collectorId };

    // Fetch actual collections / transactions
    const collections = await this.prisma.transactionUserAssignments.findMany({
      where: collectionWhere,
      select: {
        amount: true,
        year: true,
        month: true,
        userId: true,
        Transaction: {
          select: {
            paymentDate: true,
          },
        },
      },
    });

    // Initialize 12-month arrays
    const targetAmounts = Array(12).fill(0);
    const collectedAmounts = Array(12).fill(0); // for now all zeros
    // const userIds = new Set<number>();

    // Sum targets
    targets.forEach(t => {
      targetAmounts[t.month - 1] += Number(t.targetAmount);
    });

    // Sum collections per month
    collections.forEach(c => {
      collectedAmounts[c.Transaction?.paymentDate?.getMonth()] += Number(c.amount);
    });

    return {
      // userIds: Array.from(userIds),
      targetAmounts,
      collectedAmounts,
    };
  }
}
