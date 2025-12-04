import { Prisma, PrismaClient } from "@prisma/client";
import { statusNameMap } from "src/enums/loanStatus.enum";

interface FetchedCollectionData {
  loans: any[];
  sms: any[];
  marks: any[];
  comments: any[];
  committeeRequests: any[];
  charges: any[];
  courtCases: any[];
  executionCases: any[];
}

interface DataMaps {
  loanMap: Map<number, any>;
  smsMap: Map<number, any[]>;
  markMap: Map<number, any[]>;
  commentMap: Map<number, any[]>;
  committeeRequestMap: Map<number, any[]>;
  chargeMap: Map<number, any[]>;
  courtCaseMap: Map<number, any[]>;
  executionCaseMap: Map<number, any[]>;
}

interface TransactionData {
  txMap: Map<string, any[]>;
  dailyCountResult: Map<string, number>;
}

interface CollectorTarget {
  id: number;
  collectorId: number;
  User: {
    firstName: string;
    lastName: string;
  };
  targetAmount: Prisma.Decimal;
  year: number;
  month: number;
  loanIds: Prisma.JsonValue;
  createdAt: Date;
}

export interface FilterParams {
  month?: number[];
  year?: number[];
  date?: Date;
  collectorId?: number[];
}

/**
 * Fetch all collection-related data (loans, sms, marks, comments, etc.)
 */
export const fetchCollectionData = async (
  prisma: PrismaClient,
  loanIds: number[],
  collectorIds: number[]
): Promise<FetchedCollectionData> => {
  if (loanIds.length === 0) {
    return {
      loans: [],
      sms: [],
      marks: [],
      comments: [],
      committeeRequests: [],
      charges: [],
      courtCases: [],
      executionCases: [],
    };
  }

  const [loans, sms, marks, comments, committeeRequests, charges, courtCases, executionCases] =
    await Promise.all([
      // Fetch loans
      prisma.loan.findMany({
        where: { id: { in: loanIds }, deletedAt: null, closedAt: null },
        select: {
          id: true,
          principal: true,
          statusId: true,
          actDays: true,
          debtorId: true,
        }
      }),

      // Fetch SMS history
      prisma.smsHistory.findMany({
        where: {
          loanId: { in: loanIds },
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
      }),

      // Fetch marks
      prisma.loanMarks.findMany({
        where: {
          loanId: { in: loanIds },
          userId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          userId: true,
          createdAt: true,
        }
      }),

      // Fetch comments
      prisma.comments.findMany({
        where: {
          loanId: { in: loanIds },
          userId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          userId: true,
          createdAt: true,
        }
      }),

      // Fetch committee requests
      prisma.committee.findMany({
        where: {
          loanId: { in: loanIds },
          requesterId: { in: collectorIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          requesterId: true,
          createdAt: true,
        }
      }),

      // Fetch charges
      prisma.charges.findMany({
        where: {
          loanId: { in: loanIds },
          deletedAt: null,
        },
        select: {
          id: true,
          loanId: true,
          amount: true,
          createdAt: true,
          chargeTypeId: true,
        }
      }),

      // Fetch court cases (legalStageId: 61)
      prisma.loanLegalStage.findMany({
        where: { loanId: { in: loanIds }, deletedAt: null, legalStageId: 61 },
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
      }),

      // Fetch execution cases (legalStageId: 62)
      prisma.loanLegalStage.findMany({
        where: { loanId: { in: loanIds }, deletedAt: null, legalStageId: 62 },
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
      }),
    ]);

  return {
    loans,
    sms,
    marks,
    comments,
    committeeRequests,
    charges,
    courtCases,
    executionCases,
  };
};


/**
 * Build maps from fetched collection data for efficient lookups
 */
export const buildDataMaps = (data: FetchedCollectionData): DataMaps => {
  const { loans, sms, marks, comments, committeeRequests, charges, courtCases, executionCases } = data;

  // Build loan map
  const loanMap = new Map();
  for (const loan of loans) {
    loanMap.set(loan.id, loan);
  }

  // Build SMS map
  const smsMap = new Map<number, any[]>();
  for (const s of sms) {
    if (!smsMap.has(s.loanId)) smsMap.set(s.loanId, []);
    smsMap.get(s.loanId)!.push(s);
  }

  // Build marks map
  const markMap = new Map<number, any[]>();
  for (const m of marks) {
    if (!markMap.has(m.loanId)) markMap.set(m.loanId, []);
    markMap.get(m.loanId)!.push(m);
  }

  // Build comments map
  const commentMap = new Map<number, any[]>();
  for (const c of comments) {
    if (!commentMap.has(c.loanId)) commentMap.set(c.loanId, []);
    commentMap.get(c.loanId)!.push(c);
  }

  // Build committee request map
  const committeeRequestMap = new Map<number, any[]>();
  for (const c of committeeRequests) {
    if (!committeeRequestMap.has(c.loanId)) committeeRequestMap.set(c.loanId, []);
    committeeRequestMap.get(c.loanId)!.push(c);
  }

  // Build charge map
  const chargeMap = new Map<number, any[]>();
  for (const c of charges) {
    if (!chargeMap.has(c.loanId)) chargeMap.set(c.loanId, []);
    chargeMap.get(c.loanId)!.push(c);
  }

  // Build court case map
  const courtCaseMap = new Map<number, any[]>();
  for (const c of courtCases) {
    const loanId = c?.Loan?.id;
    if (!loanId) continue;
    if (!courtCaseMap.has(loanId)) courtCaseMap.set(loanId, []);
    courtCaseMap.get(loanId)!.push(c);
  }

  // Build execution case map
  const executionCaseMap = new Map<number, any[]>();
  for (const e of executionCases) {
    const loanId = e?.Loan?.id;
    if (!loanId) continue;
    if (!executionCaseMap.has(loanId)) executionCaseMap.set(loanId, []);
    executionCaseMap.get(loanId)!.push(e);
  }

  return {
    loanMap,
    smsMap,
    markMap,
    commentMap,
    committeeRequestMap,
    chargeMap,
    courtCaseMap,
    executionCaseMap,
  };
};

/**
 * Fetch transactions and apply 2-day rule for counting
 */
export const fetchAndProcessTransactions = async (
  prisma: PrismaClient,
  collectorIds: number[],
  years: number[],
  months: number[]
): Promise<TransactionData> => {
  const allTransactions = await prisma.transactionUserAssignments.findMany({
    where: {
      userId: { in: collectorIds },
      deletedAt: null,
      year: { in: years },
      month: { in: months },
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

  // Build transaction map by collector/year/month
  const txMap = new Map<string, typeof allTransactions>();
  for (const tx of allTransactions) {
    const key = `${tx.userId}_${tx.year}_${tx.month}`;
    if (!txMap.has(key)) txMap.set(key, []);
    txMap.get(key)!.push(tx as any);
  }

  // Flatten transactions with loan IDs
  const flattenedTxs = allTransactions.flatMap(tx => {
    const loanId = tx.Transaction?.Loan?.id;
    if (!loanId) return [];
    return {
      userId: tx.userId,
      year: tx.year,
      month: tx.month,
      loanId,
      amount: Number(tx.amount || 0),
      createdAt: tx.createdAt
    };
  });

  // Group transactions per loan per collector/month
  const loanTxMap = new Map<string, Date[]>();
  for (const tx of flattenedTxs) {
    const key = `${tx.userId}_${tx.year}_${tx.month}_${tx.loanId}`;
    if (!loanTxMap.has(key)) loanTxMap.set(key, []);
    loanTxMap.get(key)!.push(tx.createdAt);
  }

  // Apply 2-day rule for counting transactions
  const dailyCountResult = new Map<string, number>();
  for (const [key, dates] of loanTxMap) {
    dates.sort((a, b) => a.getTime() - b.getTime());

    let count = 0;
    let lastCounted: Date | null = null;

    for (const date of dates) {
      if (!lastCounted || (date.getTime() - lastCounted.getTime()) > 2 * 24 * 60 * 60 * 1000) {
        count++;
        lastCounted = date;
      }
    }

    const [userId, year, month] = key.split('_');
    const collectorKey = `${userId}_${year}_${month}`;
    dailyCountResult.set(collectorKey, (dailyCountResult.get(collectorKey) || 0) + count);
  }

  return { txMap, dailyCountResult };
};

/**
 * Fetch and map debtor status history
 */
export const fetchDebtorStatusHistory = async (
  prisma: PrismaClient,
  debtorIds: number[]
): Promise<Map<number, any[]>> => {
  if (debtorIds.length === 0) {
    return new Map();
  }

  const debtorStatusHistory = await prisma.debtorStatusHistory.findMany({
    where: {
      debtorId: { in: debtorIds },
      deletedAt: null
    },
    select: {
      id: true,
      debtorId: true,
      newStatusId: true,
      createdAt: true,
    }
  });

  const debtorStatusMap = new Map<number, typeof debtorStatusHistory>();
  for (const record of debtorStatusHistory) {
    if (!debtorStatusMap.has(record.debtorId)) {
      debtorStatusMap.set(record.debtorId, []);
    }
    debtorStatusMap.get(record.debtorId)!.push(record);
  }

  return debtorStatusMap;
};

/**
 * Calculate all metrics for a single collector target
 */
export const calculateCollectorMetrics = (
  item: CollectorTarget,
  maps: DataMaps,
  transactionData: TransactionData,
  debtorStatusMap: Map<number, any[]>,
  filters: FilterParams
) => {
  const { loanMap, smsMap, markMap, commentMap, committeeRequestMap, chargeMap, courtCaseMap, executionCaseMap } = maps;
  const { txMap, dailyCountResult } = transactionData;

  const ids = Array.isArray(item.loanIds) ? (item.loanIds as number[]) : [];

  const relatedLoans = ids.map((id: number) => loanMap.get(id)).filter(Boolean);

  // Calculate total principal
  const totalPrincipal = relatedLoans.reduce((sum, loan) => sum + Number(loan.principal), 0);

  // Calculate over 40 days count
  const over40DaysCount = relatedLoans.filter(loan => loan.actDays > 40).length;

  // Calculate status counts
  const statusCount: Record<string, number> = {};
  for (const loan of relatedLoans) {
    const name = statusNameMap[loan.statusId] || `UNKNOWN_${loan.statusId}`;
    statusCount[name] = (statusCount[name] || 0) + 1;
  }

  // Determine date range for filtering
  const start = item.createdAt;
  const lastDayOfMonth = new Date(item.year, item.month, 0);

  let end: Date;
  if (filters.month?.length === 1 && filters.year?.length === 1) {
    end = lastDayOfMonth;
  } else if (filters.date) {
    end = filters.date < lastDayOfMonth ? filters.date : lastDayOfMonth;
  } else {
    const today = new Date();
    end = today < lastDayOfMonth ? today : lastDayOfMonth;
  }

  // Calculate transaction metrics
  const key = `${item.collectorId}_${item.year}_${item.month}`;
  const txs = txMap.get(key) ?? [];
  const filteredTxs = txs.filter((tx: any) => tx.createdAt >= start && tx.createdAt <= end);
  const totalTransactionAmount = filteredTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const collectionRate = (totalTransactionAmount / Number(item.targetAmount)) * 100;

  const transactionCount = dailyCountResult.get(key) || 0;
  const paymentSuccessRate = relatedLoans.length > 0 ? (transactionCount / relatedLoans.length) * 100 : 0;

  // Calculate activity counts (SMS, marks, comments, committee requests)
  let smsCount = 0;
  let markCount = 0;
  let commentCount = 0;
  let committeeRequestCount = 0;

  for (const loanId of ids) {
    // SMS
    const smsArr = smsMap.get(loanId as number) || [];
    smsCount += smsArr.filter(s =>
      s.userId === item.collectorId &&
      s.createdAt >= start &&
      s.createdAt <= end &&
      s.createdAt.getFullYear() === item.year &&
      (s.createdAt.getMonth() + 1) === item.month
    ).length;

    // Marks
    const markArr = markMap.get(loanId as number) || [];
    markCount += markArr.filter(m =>
      m.userId === item.collectorId &&
      m.createdAt >= start &&
      m.createdAt <= end &&
      m.createdAt.getFullYear() === item.year &&
      (m.createdAt.getMonth() + 1) === item.month
    ).length;

    // Comments
    const commentArr = commentMap.get(loanId as number) || [];
    commentCount += commentArr.filter(c =>
      c.userId === item.collectorId &&
      c.createdAt >= start &&
      c.createdAt <= end &&
      c.createdAt.getFullYear() === item.year &&
      (c.createdAt.getMonth() + 1) === item.month
    ).length;

    // Committee Requests
    const committeeArr = committeeRequestMap.get(loanId as number) || [];
    committeeRequestCount += committeeArr.filter(c =>
      c.requesterId === item.collectorId &&
      c.createdAt >= start &&
      c.createdAt <= end &&
      c.createdAt.getFullYear() === item.year &&
      (c.createdAt.getMonth() + 1) === item.month
    ).length;
  }

  // Calculate charges
  const relatedCharges = ids
    .flatMap((id: number) => chargeMap.get(id) || [])
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

  // Calculate court and execution case metrics
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

  const courtPrincipalSum = Array.from(courtLoanIds).reduce(
    (sum, lid) => sum + Number(loanMap.get(lid)?.principal ?? 0),
    0
  );
  const executionPrincipalSum = Array.from(executionLoanIds).reduce(
    (sum, lid) => sum + Number(loanMap.get(lid)?.principal ?? 0),
    0
  );

  // Calculate debtor status change count
  let debtorStatusChangeCount = 0;
  const uniqueDebtors = Array.from(new Set(relatedLoans.map(l => l.debtorId).filter(Boolean)));

  for (const debtorId of uniqueDebtors) {
    const history = debtorStatusMap.get(debtorId) || [];
    const filtered = history
      .map((h: any) => ({ ...h, createdAt: new Date(h.createdAt) }))
      .filter(h => h.createdAt >= start && h.createdAt <= end)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (filtered.length === 0) continue;

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
    monthlyPlan: Number(item.targetAmount),
    adjustedPlan: Number(item.targetAmount),
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
    callCount: 0,
    totalCallDurationSec: "00:00:00",
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
};

export const determinePlanDataSource = (years: number[] | undefined, currentYear: number) => {
  let oldYears: number[] = [];
  let newYears: number[] = [];
  let defaultIsNew = false;

  // --- YEAR MISSING ---
  if (!years || years.length === 0) {
    if (currentYear < 2026) {
      // Before migration → use OLD
      defaultIsNew = false;
    } else {
      // After migration → use NEW
      defaultIsNew = true;
    }
    return { oldYears: [], newYears: [], defaultIsNew };
  }

  // --- YEAR PROVIDED ---
  oldYears = years.filter(y => y < 2026);
  newYears = years.filter(y => y >= 2026);

  return { oldYears, newYears, defaultIsNew };
}
export const mapOldPlanReport = (data: any[]) => {
  return data.map(item => {
    return {
      collectorId: item.Collector_ID,
      collector: item.Collector,
      year: item.PlanYear,
      month: item.PlanMonth,
      openingPrincipal: Number(item.Principal),
      monthlyPlan: Number(item.PlanSumm),
      adjustedPlan: Number(item.PlanSumm), // Assuming same as PlanSumm
      collectedAmount: Number(item.PlanCollection),
      collectionRatePercent: Number(item.Percent),
      paidLoanCount: item.PaymentsCount,
      paymentSuccessRate: Number(item.PaymentsRate),
      newLoanCount: item.New,
      communicatedCount: item.Communication,
      unreachableCount: item.Unreachable,
      agreementCount: item.Agreement,
      agreementCancelledCount: item.AgreementCancel,
      refuseToPayCount: item.RefusedToPay,
      promiseToPayCount: item.PromisedToPay,
      totalLoanCount: item.CaseCount,
      callCount: item.Calls,
      totalCallDurationSec: item.DurationTime, // Already formatted as "HH:MM:SS"
      smsCount: item.SMS || 0,
      markCount: item.Marks,
      commentCount: item.Comment,
      committeeRequestCount: item.Committee,
      inactiveOver40DaysCount: item.Day40,
      debtorStatusCount: item.Clients,
      totalActivities: item.Total,
      totalLegalCharges: Number(item.LegalCharges),
      totalOtherCharges: 0,
      courtCaseCount: item.CourtCaseCount,
      courtPrincipalSum: Number(item.CourtCaseAmount),
      executionCaseCount: item.ExecCaseCount,
      executionPrincipalSum: Number(item.ExecCaseAmount),
    };
  });
};
