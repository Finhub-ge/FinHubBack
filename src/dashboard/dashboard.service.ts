import { Injectable } from '@nestjs/common';
import { GetPlanReportDto, GetPlanReportWithPaginationDto } from './dto/getPlanReport.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationService } from 'src/common/services/pagination.service';
import { statusNameMap } from 'src/enums/loanStatus.enum';
import { buildDataMaps, calculateCollectorMetrics, determinePlanDataSource, fetchAndProcessTransactions, fetchCollectionData, fetchDebtorStatusHistory } from 'src/helpers/report.helper';
import { getYear } from 'src/helpers/date.helper';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) { }
  async getPlanChart(getPlanReportDto: GetPlanReportDto) {
    const currentYear = new Date().getFullYear();
    const { collectorId, year } = getPlanReportDto;

    const { oldYears, newYears, defaultIsNew } = determinePlanDataSource(year, currentYear);

    // Helper: initialize 12-month arrays
    const initMonthlyArrays = () => ({ targetAmounts: Array(12).fill(0), collectedAmounts: Array(12).fill(0) });

    // Helper: sum old plan collection
    const sumOldData = (data: any[], targetAmounts: number[], collectedAmounts: number[]) => {
      data.forEach(t => {
        targetAmounts[t.PlanMonth - 1] += Number(t.PlanSumm);
        collectedAmounts[t.PlanMonth - 1] += Number(t.PlanCollection);
      });
    };

    // Helper: sum new plan data
    const sumNewData = (targets: any[], collections: any[], targetAmounts: number[], collectedAmounts: number[]) => {
      targets.forEach(t => targetAmounts[t.month - 1] += Number(t.targetAmount));
      collections.forEach(c => {
        const m = c.Transaction?.paymentDate?.getMonth();
        if (m !== undefined && m >= 0) collectedAmounts[m] += Number(c.amount);
      });
    };

    // Initialize arrays
    const { targetAmounts, collectedAmounts } = initMonthlyArrays();

    // --- OLD DATA ---
    if (oldYears.length > 0 || (!year && currentYear < 2026)) {
      const where: any = {};
      if (year?.length) where.PlanYear = { in: year };
      const targetWhere: any = { ...where };
      if (collectorId?.length) targetWhere.Collector_ID = { in: collectorId };

      const oldPlanCollection = await this.prisma.old_db_plan_collection.findMany({
        where: targetWhere,
        select: { PlanYear: true, Collector_ID: true, PlanMonth: true, PlanSumm: true, PlanCollection: true },
      });

      sumOldData(oldPlanCollection, targetAmounts, collectedAmounts);
    }

    // --- NEW DATA ---
    if (newYears.length > 0 || defaultIsNew) {
      const where: any = {};
      if (year?.length) where.year = { in: year };

      const targetWhere: any = { ...where };
      if (collectorId?.length) targetWhere.collectorId = { in: collectorId };

      const targets = await this.prisma.collectorsMonthlyTarget.findMany({
        where: targetWhere,
        select: { targetAmount: true, month: true, year: true, collectorId: true },
      });

      const collectionWhere: any = { ...where, roleId: 7 };
      if (collectorId?.length) collectionWhere.userId = { in: collectorId };

      const collections = await this.prisma.transactionUserAssignments.findMany({
        where: collectionWhere,
        select: { amount: true, year: true, month: true, userId: true, Transaction: { select: { paymentDate: true } } },
      });

      sumNewData(targets, collections, targetAmounts, collectedAmounts);
    }

    return { targetAmounts, collectedAmounts };
  }

  async getPlanReport(getPlanReportDto: GetPlanReportWithPaginationDto) {
    const { page, limit, skip, ...filters } = getPlanReportDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit, skip });

    // Build Prisma where clause for targets
    const targetWhere: any = {};
    if (filters.year && filters.year.length > 0) targetWhere.year = { in: filters.year };
    if (filters.month && filters.month.length > 0) targetWhere.month = { in: filters.month };
    if (filters.collectorId && filters.collectorId.length > 0) targetWhere.collectorId = { in: filters.collectorId };

    // Fetch collector monthly targets
    const data = await this.prisma.collectorsMonthlyTarget.findMany({
      where: targetWhere,
      select: {
        id: true,
        collectorId: true,
        User: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        targetAmount: true,
        year: true,
        month: true,
        loanIds: true,
        createdAt: true,
      },
      ...paginationParams,
    });

    // Extract all loan IDs and collector IDs
    const allLoanIds = data
      .flatMap(t => (Array.isArray(t.loanIds) ? t.loanIds : []))
      .filter(Boolean) as number[];
    const collectorIds = data.map(t => t.collectorId);

    // Fetch all collection-related data
    const collectionData = await fetchCollectionData(
      this.prisma,
      allLoanIds,
      collectorIds
    );

    // Build maps for efficient lookups
    const dataMaps = buildDataMaps(collectionData);

    // Fetch and process transactions with 2-day rule
    const transactionData = await fetchAndProcessTransactions(
      this.prisma,
      collectorIds,
      data.map(d => d.year),
      data.map(d => d.month)
    );

    // Fetch debtor status history
    const debtorIds = collectionData.loans.map(l => l.debtorId).filter(Boolean) as number[];
    const debtorStatusMap = await fetchDebtorStatusHistory(this.prisma, debtorIds);

    // Calculate metrics for each collector target
    const result = data.map(item =>
      calculateCollectorMetrics(item, dataMaps, transactionData, debtorStatusMap, filters)
    );

    // Get total count for pagination
    const total = await this.prisma.collectorsMonthlyTarget.count({
      where: targetWhere,
    });

    return this.paginationService.createPaginatedResult(result, total, { page, limit, skip });
  }

  // TODO: remove this function
  async getPlanReportV1(getPlanReportDto: GetPlanReportWithPaginationDto) {
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

  // TODO: remove this function
  async getPlanReportV2(getPlanReportDto: GetPlanReportWithPaginationDto) {
    const { page, limit, skip, ...filters } = getPlanReportDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit, skip });

    // Build Prisma where clause
    const targetWhere: any = {};
    if (filters.year && filters.year.length > 0) targetWhere.year = { in: filters.year };
    if (filters.month && filters.month.length > 0) targetWhere.month = { in: filters.month };

    // const targetWhere: any = { ...where };
    if (filters.collectorId && filters.collectorId.length > 0) targetWhere.collectorId = { in: filters.collectorId };

    const data = await this.prisma.collectorsMonthlyTarget.findMany({
      where: targetWhere,
      select: {
        id: true,
        collectorId: true,
        User: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        targetAmount: true,
        year: true,
        month: true,
        loanIds: true,
        createdAt: true,
      },
      ...paginationParams,
    });
    const allLoanIds = data
      .flatMap(t => (Array.isArray(t.loanIds) ? t.loanIds : []))
      .filter(Boolean);

    const collectorIds = data.map(t => t.collectorId);

    let loans = [];
    let sms = []
    let marks = []
    let comments = []
    let committeeRequests = []
    let charges = []
    let courtCases = []
    let executionCases = []

    if (allLoanIds.length > 0) {
      loans = await this.prisma.loan.findMany({
        where: { id: { in: allLoanIds as number[] }, deletedAt: null, closedAt: null },
        select: {
          id: true,
          principal: true,
          statusId: true,
          actDays: true,
          debtorId: true,
        }
      });
      sms = await this.prisma.smsHistory.findMany({
        where: {
          loanId: { in: allLoanIds as number[] },
          userId: { in: collectorIds },
          deletedAt: null,
          status: 'success',
        },
        select: {
          id: true,
          loanId: true,
          userId: true,
          createdAt: true,
        }
      });
      marks = await this.prisma.loanMarks.findMany({
        where: {
          loanId: { in: allLoanIds as number[] },
          userId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          userId: true,
          createdAt: true,
        }
      });
      comments = await this.prisma.comments.findMany({
        where: {
          loanId: { in: allLoanIds as number[] },
          userId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          userId: true,
          createdAt: true,
        }
      });
      committeeRequests = await this.prisma.committee.findMany({
        where: {
          loanId: { in: allLoanIds as number[] },
          requesterId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          requesterId: true,
          createdAt: true,
        }
      });
      charges = await this.prisma.charges.findMany({
        where: {
          loanId: { in: allLoanIds as number[] },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          amount: true,
          createdAt: true,
          chargeTypeId: true,
        }
      });
      courtCases = await this.prisma.loanLegalStage.findMany({
        where: { loanId: { in: allLoanIds as number[] }, deletedAt: null, legalStageId: 61 },
        select: {
          id: true,
          createdAt: true,
          Loan: {
            select: {
              id: true,
              principal: true,
            }
          }
        }
      });
      executionCases = await this.prisma.loanLegalStage.findMany({
        where: { loanId: { in: allLoanIds as number[] }, deletedAt: null, legalStageId: 62 },
        select: {
          id: true,
          createdAt: true,
          Loan: {
            select: {
              id: true,
              principal: true,
            }
          }
        }
      });
    }
    // console.log(courtCases)
    const loanMap = new Map();
    for (const loan of loans) {
      loanMap.set(loan.id, loan);
    }
    const smsMap = new Map<number, any[]>();
    for (const s of sms) {
      if (!smsMap.has(s.loanId)) smsMap.set(s.loanId, []);
      smsMap.get(s.loanId).push(s);
    }

    const markMap = new Map<number, any[]>();
    for (const m of marks) {
      if (!markMap.has(m.loanId)) markMap.set(m.loanId, []);
      markMap.get(m.loanId).push(m);
    }

    const commentMap = new Map<number, any[]>();
    for (const c of comments) {
      if (!commentMap.has(c.loanId)) commentMap.set(c.loanId, []);
      commentMap.get(c.loanId).push(c);
    }
    const committeeRequestMap = new Map<number, any[]>();
    for (const c of committeeRequests) {
      if (!committeeRequestMap.has(c.loanId)) committeeRequestMap.set(c.loanId, []);
      committeeRequestMap.get(c.loanId).push(c);
    }

    const chargeMap = new Map<number, any[]>();
    for (const c of charges) {
      if (!chargeMap.has(c.loanId)) chargeMap.set(c.loanId, []);
      chargeMap.get(c.loanId).push(c);
    }

    const courtCaseMap = new Map<number, any[]>();
    for (const c of courtCases) {
      const loanId = c?.Loan?.id;
      if (!loanId) continue;
      if (!courtCaseMap.has(loanId)) courtCaseMap.set(loanId, []);
      courtCaseMap.get(loanId)!.push(c);
    }

    const executionCaseMap = new Map<number, any[]>();
    for (const e of executionCases) {
      const loanId = e?.Loan?.id;
      if (!loanId) continue;
      if (!executionCaseMap.has(loanId)) executionCaseMap.set(loanId, []);
      executionCaseMap.get(loanId)!.push(e);
    }

    const allTransactions = await this.prisma.transactionUserAssignments.findMany({
      where: {
        userId: { in: collectorIds },
        deletedAt: null,
        year: { in: data.map(d => d.year) },
        month: { in: data.map(d => d.month) },
      },
      select: {
        userId: true,
        year: true,
        month: true,
        amount: true,
        createdAt: true,
        Transaction: {
          select: {
            Loan: {
              select: {
                id: true,
              }
            }
          }
        }
      }
    });

    const txMap = new Map<string, typeof allTransactions[]>();
    for (const tx of allTransactions) {
      const key = `${tx.userId}_${tx.year}_${tx.month}`;
      if (!txMap.has(key)) txMap.set(key, []);
      txMap.get(key)!.push(tx as any);
    }

    const flattenedTxs = allTransactions.flatMap(tx => {
      const loanId = tx.Transaction?.Loan?.id;
      if (!loanId) return []; // skip transactions without a loan
      return {
        userId: tx.userId,
        year: tx.year,
        month: tx.month,
        loanId,
        amount: Number(tx.amount || 0),
        createdAt: tx.createdAt
      };
    });

    const loanTxMap = new Map<string, Date[]>();

    // 1️⃣ Group transactions per loan per collector/month
    for (const tx of flattenedTxs) {
      const key = `${tx.userId}_${tx.year}_${tx.month}_${tx.loanId}`;
      if (!loanTxMap.has(key)) loanTxMap.set(key, []);
      loanTxMap.get(key)!.push(tx.createdAt);
    }

    // 2️⃣ Count transactions using 2-day rule
    const dailyCountResult = new Map<string, number>(); // key = `${userId}_${year}_${month}`

    for (const [key, dates] of loanTxMap) {
      // Sort dates ascending
      dates.sort((a, b) => a.getTime() - b.getTime());

      let count = 0;
      let lastCounted: Date | null = null;

      for (const date of dates) {
        if (!lastCounted || (date.getTime() - lastCounted.getTime()) > 2 * 24 * 60 * 60 * 1000) {
          // More than 2 days from last counted → new transaction
          count++;
          lastCounted = date;
        }
      }

      // Sum per collector/month
      const [userId, year, month] = key.split('_');
      const collectorKey = `${userId}_${year}_${month}`;
      dailyCountResult.set(collectorKey, (dailyCountResult.get(collectorKey) || 0) + count);
    }

    const debtorIds = loans.map(l => l.debtorId).filter(Boolean);

    let debtorStatusHistory = [];
    if (debtorIds.length > 0) {
      debtorStatusHistory = await this.prisma.debtorStatusHistory.findMany({
        where: {
          debtorId: { in: debtorIds as number[] },
          deletedAt: null
        },
        select: {
          id: true,
          debtorId: true,
          newStatusId: true,
          createdAt: true,
        }
      });
    }

    const debtorStatusMap = new Map<number, typeof debtorStatusHistory[]>();

    for (const record of debtorStatusHistory) {
      if (!debtorStatusMap.has(record.debtorId))
        debtorStatusMap.set(record.debtorId, []);
      debtorStatusMap.get(record.debtorId)!.push(record);
    }

    // return dailyCountResult
    const result = data.map(item => {
      const ids = Array.isArray(item.loanIds) ? item.loanIds : [];

      const relatedLoans = ids
        .map(id => loanMap.get(id))
        .filter(Boolean);

      const totalPrincipal = relatedLoans.reduce(
        (sum, loan) => sum + Number(loan.principal),
        0
      );

      const over40DaysCount = relatedLoans.filter(
        loan => loan.actDays > 40
      ).length;

      const statusCount: Record<string, number> = {};
      for (const loan of relatedLoans) {
        const name = statusNameMap[loan.statusId] || `UNKNOWN_${loan.statusId}`;
        statusCount[name] = (statusCount[name] || 0) + 1;
      }

      const key = `${item.collectorId}_${item.year}_${item.month}`;
      const txs = txMap.get(key) ?? [];

      const start = item.createdAt; // start from when target was created
      const lastDayOfMonth = new Date(item.year, item.month, 0);

      // If filters specify specific month/year matching this row → end = last day of that month
      let end: Date;

      if (filters.month?.length === 1 && filters.year?.length === 1) {
        // Strict monthly filter → always use last day of that month
        end = lastDayOfMonth;
      } else if (filters.date) {
        // Use filters.date but cap to last day of selected month
        end = filters.date < lastDayOfMonth ? filters.date : lastDayOfMonth;
      } else {
        // Default: today but capped to end of month
        const today = new Date();
        end = today < lastDayOfMonth ? today : lastDayOfMonth;
      }

      const filteredTxs = txs.filter((tx: any) => tx.createdAt >= start && tx.createdAt <= end);
      const totalTransactionAmount = filteredTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const collectionRate = totalTransactionAmount / Number(item.targetAmount) * 100;


      const keys = `${item.collectorId}_${item.year}_${item.month}`;
      const transactionCount = dailyCountResult.get(keys) || 0;
      const paymentSuccessRate = transactionCount / relatedLoans.length * 100;

      let smsCount = 0;
      let markCount = 0;
      let commentCount = 0;
      let committeeRequestCount = 0;

      for (const loanId of ids) {
        const arr = smsMap.get(loanId as number);
        if (!arr) continue;
        smsCount += arr.filter(s =>
          s.userId === item.collectorId &&
          s.createdAt >= start &&
          s.createdAt <= end &&
          s.createdAt.getFullYear() === item.year &&
          (s.createdAt.getMonth() + 1) === item.month
        ).length;

        const marr = markMap.get(loanId as number);
        if (!marr) continue;

        markCount += marr.filter(m =>
          m.userId === item.collectorId &&
          m.createdAt >= start &&
          m.createdAt <= end &&
          m.createdAt.getFullYear() === item.year &&
          (m.createdAt.getMonth() + 1) === item.month
        ).length;

        const cmm = commentMap.get(loanId as number);
        if (!cmm) continue;

        commentCount += cmm.filter(c =>
          c.userId === item.collectorId &&
          c.createdAt >= start &&
          c.createdAt <= end &&
          c.createdAt.getFullYear() === item.year &&
          (c.createdAt.getMonth() + 1) === item.month
        ).length;

        const cmmr = committeeRequestMap.get(loanId as number);
        if (!cmmr) continue;

        committeeRequestCount += cmmr.filter(c =>
          c.requesterId === item.collectorId &&
          c.createdAt >= start &&
          c.createdAt <= end &&
          c.createdAt.getFullYear() === item.year &&
          (c.createdAt.getMonth() + 1) === item.month
        ).length;

        const chargesArr = chargeMap.get(loanId as number);
        if (!chargesArr) continue;
        const totalLegalCharges = chargesArr.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      }

      const relatedCharges = ids
        .flatMap(id => chargeMap.get(id as number) || [])
        .filter(ch => ch.createdAt >= start && ch.createdAt <= end);

      const legalTypes = [1, 2];
      const otherTypes = [3, 4, 5];

      const { totalLegalCharges, totalOtherCharges } = relatedCharges.reduce(
        (acc, ch) => {
          const amount = Number(ch.amount ?? 0);

          if (legalTypes.includes(ch.chargeTypeId)) {
            acc.totalLegalCharges += amount;
          } else if (otherTypes.includes(ch.chargeTypeId)) {
            acc.totalOtherCharges += amount;
          }

          return acc;
        },
        { totalLegalCharges: 0, totalOtherCharges: 0 }
      );

      // court & execution: count cases and sum unique loan principals for cases in date range
      let courtCaseCount = 0;
      let executionCaseCount = 0;
      const courtLoanIds = new Set<number>();
      const executionLoanIds = new Set<number>();

      for (const loanId of ids) {
        const cArr = courtCaseMap.get(loanId as number) ?? [];
        const matchedCourt = cArr.filter(cc => cc.createdAt >= start && cc.createdAt <= end);
        courtCaseCount += matchedCourt.length;
        if (matchedCourt.length > 0) courtLoanIds.add(loanId as number);

        const eArr = executionCaseMap.get(loanId as number) ?? [];
        const matchedExec = eArr.filter(ec => ec.createdAt >= start && ec.createdAt <= end);
        executionCaseCount += matchedExec.length;
        if (matchedExec.length > 0) executionLoanIds.add(loanId as number);
      }

      const courtPrincipalSum = Array.from(courtLoanIds).reduce((sum, lid) => sum + Number(loanMap.get(lid)?.principal ?? 0), 0);
      const executionPrincipalSum = Array.from(executionLoanIds).reduce((sum, lid) => sum + Number(loanMap.get(lid)?.principal ?? 0), 0);

      let debtorStatusChangeCount = 0;

      // Get unique debtor IDs from the related loans
      const uniqueDebtors = Array.from(
        new Set(relatedLoans.map(l => l.debtorId).filter(Boolean))
      );

      for (const debtorId of uniqueDebtors) {
        const history = debtorStatusMap.get(debtorId) || [];

        // Normalize dates and filter by reporting window
        const filtered = history
          .map((h: any) => ({ ...h, createdAt: new Date(h.createdAt) }))
          .filter(h => h.createdAt >= start && h.createdAt <= end)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (filtered.length === 0) continue; // skip if no records

        // Count 1 for the first record, then additional counts for actual status changes
        debtorStatusChangeCount += 1;

        for (let i = 1; i < filtered.length; i++) {
          if (filtered[i].newStatusId !== filtered[i - 1].newStatusId) {
            debtorStatusChangeCount++;
          }
        }
      }

      const totalActivities = smsCount + markCount + commentCount + committeeRequestCount + debtorStatusChangeCount;

      return {
        collectorId: item.collectorId,
        collector: `${item.User.firstName} ${item.User.lastName}`,
        year: item.year,
        month: item.month,
        openingPrincipal: totalPrincipal,
        monthlyPlan: item.targetAmount,
        adjustedPlan: item.targetAmount,
        collectedAmount: totalTransactionAmount,
        collectionRatePercent: collectionRate,
        paidLoanCount: transactionCount,
        paymentSuccessRate: paymentSuccessRate,
        newLoanCount: statusCount.NEW || 0,
        communicatedCount: statusCount.COMMUNICATION || 0,
        unreachableCount: statusCount.UNREACHABLE || 0,
        agreementCount: statusCount.AGREEMENT || 0,
        agreementCancelledCount: statusCount.AGREEMENT_CANCELED || 0,
        refuseToPayCount: statusCount.REFUSE_TO_PAY || 0,
        promiseToPayCount: statusCount.PROMISED_TO_PAY || 0,
        totalLoanCount: relatedLoans.length,
        "callCount": 0,
        "totalCallDurationSec": "00:00:00",
        smsCount: smsCount,
        markCount: markCount,
        commentCount: commentCount,
        committeeRequestCount: committeeRequestCount,
        inactiveOver40DaysCount: over40DaysCount || 0,
        debtorStatusCount: debtorStatusChangeCount || 0,
        totalActivities: totalActivities,
        totalLegalCharges: totalLegalCharges || 0,
        totalOtherCharges: totalOtherCharges || 0,
        courtCaseCount: courtCaseCount || 0,
        courtPrincipalSum: courtPrincipalSum || 0,
        executionCaseCount: executionCaseCount || 0,
        executionPrincipalSum: executionPrincipalSum || 0,
      };
    });

    const total = await this.prisma.collectorsMonthlyTarget.count({
      where: targetWhere,
    });
    return this.paginationService.createPaginatedResult(result, total, { page, limit, skip });
  }
}
