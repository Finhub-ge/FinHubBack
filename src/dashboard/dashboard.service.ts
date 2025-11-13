import { Injectable } from '@nestjs/common';
import { GetPlanReportDto, GetPlanReportWithPaginationDto } from './dto/getPlanReport.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationService } from 'src/common/services/pagination.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) { }
  async getPlanChart(getPlanReportDto: GetPlanReportDto) {
    const { collectorId, year } = getPlanReportDto;

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

  async getPlanReport(getPlanReportDto: GetPlanReportWithPaginationDto) {
    // const { collectorId, year, month } = getPlanReportDto;
    const { page, limit, skip, ...filters } = getPlanReportDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    // Build Prisma where clause
    const where: any = {};
    if (filters.year && filters.year.length > 0) where.year = { in: filters.year };
    if (filters.month && filters.month.length > 0) where.month = { in: filters.month };

    // const targetWhere: any = { ...where };
    if (filters.collectorId && filters.collectorId.length > 0) where.collectorId = { in: filters.collectorId };

    // Fetch targets matching filters
    const data = await this.prisma.collectorMonthlyReport.findMany({
      where,
      include: {
        User_CollectorMonthlyReport_collectorIdToUser: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      },
      ...paginationParams,
    });
    const total = await this.prisma.collectorMonthlyReport.count({
      where,
    });
    return this.paginationService.createPaginatedResult(data, total, { page, limit, skip });
  }
}
