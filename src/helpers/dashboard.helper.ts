import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Calculate date range for plan report filtering
 */
export const calculateDateRange = async (
  prisma: PrismaClient,
  targetWhere: any,
  filters: any
): Promise<{ firstDayOfMonth: Date; lastDayOfMonth: Date; endDate: Date } | null> => {
  const tempTarget = await prisma.collectorsMonthlyTarget.findFirst({
    where: targetWhere,
    select: { year: true, month: true },
  });

  if (!tempTarget) {
    return null;
  }

  const firstDayOfMonth = new Date(Date.UTC(tempTarget.year, (tempTarget.month - 1), 1));
  const lastDayOfMonth = new Date(Date.UTC(tempTarget.year, tempTarget.month, 0));

  let endDate: Date;
  if (filters.month?.length === 1 && filters.year?.length === 1) {
    endDate = lastDayOfMonth;
  } else if (filters.date) {
    endDate = filters.date < lastDayOfMonth ? filters.date : lastDayOfMonth;
  } else {
    const today = new Date();
    endDate = today < lastDayOfMonth ? today : lastDayOfMonth;
  }

  return { firstDayOfMonth, lastDayOfMonth, endDate };
};

/**
 * Fetch targets with junction table and basic loan data
 */
export const fetchTargetsWithLoans = async (
  prisma: PrismaClient,
  targetWhere: any,
  paginationParams?: any
): Promise<any[]> => {
  return await prisma.collectorsMonthlyTarget.findMany({
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
      createdAt: true,
      CollectorMonthlyTargetLoan: {
        select: {
          loanId: true,
          Loan: {
            select: {
              id: true,
              principal: true,
              statusId: true,
              actDays: true,
              debtorId: true,
              currency: true,
              LoanRemaining: {
                where: { deletedAt: null },
                select: {
                  principal: true,
                  currentDebt: true,
                  createdAt: true,
                },
                take: 1,
              },
            }
          }
        }
      }
    },
    ...paginationParams,
  });
};

/**
 * Fetch all activity data using JOINs with junction table (optimized for large datasets)
 */
export const fetchActivityData = async (
  prisma: PrismaClient,
  targetIds: number[],
  collectorIds: number[],
  firstDayOfMonth: Date,
  endDate: Date
) => {
  if (targetIds.length === 0) {
    return {
      smsData: [],
      marksData: [],
      commentsData: [],
      committeeData: [],
      chargesData: [],
      legalStagesData: [],
    };
  }

  const [smsData, marksData, commentsData, committeeData, chargesData, legalStagesData] = await Promise.all([
    // SMS History - JOIN with junction table instead of large IN clause
    prisma.$queryRaw<Array<{id: number, loanId: number, userId: number, createdAt: Date}>>`
      SELECT DISTINCT s.id, s.loanId, s.userId, s.createdAt
      FROM SmsHistory s
      INNER JOIN CollectorMonthlyTargetLoan j ON s.loanId = j.loanId
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND s.deletedAt IS NULL
        AND s.status = 'success'
        AND s.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
        ${collectorIds.length > 0 ? Prisma.sql`AND s.userId IN (${Prisma.join(collectorIds)})` : Prisma.empty}
    `,

    // Loan Marks - JOIN with junction table
    prisma.$queryRaw<Array<{id: number, loanId: number, userId: number | null, createdAt: Date}>>`
      SELECT DISTINCT m.id, m.loanId, m.userId, m.createdAt
      FROM LoanMarks m
      INNER JOIN CollectorMonthlyTargetLoan j ON m.loanId = j.loanId
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND m.deletedAt IS NULL
        AND m.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
        ${collectorIds.length > 0 ? Prisma.sql`AND m.userId IN (${Prisma.join(collectorIds)})` : Prisma.empty}
    `,

    // Comments - JOIN with junction table
    prisma.$queryRaw<Array<{id: number, loanId: number, userId: number, createdAt: Date}>>`
      SELECT DISTINCT c.id, c.loanId, c.userId, c.createdAt
      FROM Comments c
      INNER JOIN CollectorMonthlyTargetLoan j ON c.loanId = j.loanId
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND c.deletedAt IS NULL
        AND c.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
        ${collectorIds.length > 0 ? Prisma.sql`AND c.userId IN (${Prisma.join(collectorIds)})` : Prisma.empty}
    `,

    // Committee - JOIN with junction table
    prisma.$queryRaw<Array<{id: number, loanId: number, requesterId: number, createdAt: Date}>>`
      SELECT DISTINCT c.id, c.loanId, c.requesterId, c.createdAt
      FROM Committee c
      INNER JOIN CollectorMonthlyTargetLoan j ON c.loanId = j.loanId
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND c.deletedAt IS NULL
        AND c.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
        ${collectorIds.length > 0 ? Prisma.sql`AND c.requesterId IN (${Prisma.join(collectorIds)})` : Prisma.empty}
    `,

    // Charges - JOIN with junction table
    prisma.$queryRaw<Array<{id: number, loanId: number, amount: any, createdAt: Date, chargeTypeId: number, currency: string | null}>>`
      SELECT DISTINCT ch.id, ch.loanId, ch.amount, ch.createdAt, ch.chargeTypeId, ch.currency
      FROM Charges ch
      INNER JOIN CollectorMonthlyTargetLoan j ON ch.loanId = j.loanId
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND ch.deletedAt IS NULL
        AND ch.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
    `,

    // Loan Legal Stages - JOIN with junction table (court & execution cases)
    prisma.$queryRaw<Array<{
      id: number,
      legalStageId: number,
      createdAt: Date,
      loanId: number,
      publicId: string,
      caseId: string | null,
      principal: any,
      debtorId: number,
      debtorFirstName: string,
      debtorLastName: string
    }>>`
      SELECT DISTINCT
        ls.id,
        ls.legalStageId,
        ls.createdAt,
        l.id as loanId,
        l.publicId,
        l.caseId,
        l.principal,
        d.id as debtorId,
        d.firstName as debtorFirstName,
        d.lastName as debtorLastName
      FROM LoanLegalStage ls
      INNER JOIN CollectorMonthlyTargetLoan j ON ls.loanId = j.loanId
      INNER JOIN Loan l ON ls.loanId = l.id
      INNER JOIN Debtor d ON l.debtorId = d.id
      WHERE j.monthlyTargetId IN (${Prisma.join(targetIds)})
        AND ls.deletedAt IS NULL
        AND ls.legalStageId IN (61, 62)
        AND ls.createdAt BETWEEN ${firstDayOfMonth} AND ${endDate}
    `,
  ]);

  return { smsData, marksData, commentsData, committeeData, chargesData, legalStagesData };
};

/**
 * Build lookup maps from activity data for fast access by loanId
 */
export const buildActivityMaps = (activityData: {
  smsData: any[],
  marksData: any[],
  commentsData: any[],
  committeeData: any[],
  chargesData: any[],
  legalStagesData: any[]
}) => {
  const { smsData, marksData, commentsData, committeeData, chargesData, legalStagesData } = activityData;

  const smsMap = new Map<number, any[]>();
  smsData.forEach(s => {
    if (!smsMap.has(s.loanId)) smsMap.set(s.loanId, []);
    smsMap.get(s.loanId)!.push(s);
  });

  const marksMap = new Map<number, any[]>();
  marksData.forEach(m => {
    if (!marksMap.has(m.loanId)) marksMap.set(m.loanId, []);
    marksMap.get(m.loanId)!.push(m);
  });

  const commentsMap = new Map<number, any[]>();
  commentsData.forEach(c => {
    if (!commentsMap.has(c.loanId)) commentsMap.set(c.loanId, []);
    commentsMap.get(c.loanId)!.push(c);
  });

  const committeeMap = new Map<number, any[]>();
  committeeData.forEach(c => {
    if (!committeeMap.has(c.loanId)) committeeMap.set(c.loanId, []);
    committeeMap.get(c.loanId)!.push(c);
  });

  const chargesMap = new Map<number, any[]>();
  chargesData.forEach(c => {
    if (!chargesMap.has(c.loanId)) chargesMap.set(c.loanId, []);
    chargesMap.get(c.loanId)!.push(c);
  });

  const courtCasesMap = new Map<number, any[]>();
  const executionCasesMap = new Map<number, any[]>();
  legalStagesData.forEach(ls => {
    // Raw SQL returns flattened structure, reconstruct nested format
    const legalStageRecord = {
      id: ls.id,
      legalStageId: ls.legalStageId,
      createdAt: ls.createdAt,
      Loan: {
        id: ls.loanId,
        publicId: ls.publicId,
        caseId: ls.caseId,
        principal: ls.principal,
        Debtor: {
          id: ls.debtorId,
          firstName: ls.debtorFirstName,
          lastName: ls.debtorLastName,
        },
        LoanAssignment: [], // Will be populated if needed
      }
    };

    if (ls.legalStageId === 61) {
      if (!courtCasesMap.has(ls.loanId)) courtCasesMap.set(ls.loanId, []);
      courtCasesMap.get(ls.loanId)!.push(legalStageRecord);
    } else if (ls.legalStageId === 62) {
      if (!executionCasesMap.has(ls.loanId)) executionCasesMap.set(ls.loanId, []);
      executionCasesMap.get(ls.loanId)!.push(legalStageRecord);
    }
  });

  return { smsMap, marksMap, commentsMap, committeeMap, chargesMap, courtCasesMap, executionCasesMap };
};

/**
 * Transform targets with activity data into collection data structure
 */
export const transformTargetsWithActivity = (
  targets: any[],
  activityMaps: {
    smsMap: Map<number, any[]>,
    marksMap: Map<number, any[]>,
    commentsMap: Map<number, any[]>,
    committeeMap: Map<number, any[]>,
    chargesMap: Map<number, any[]>,
    courtCasesMap: Map<number, any[]>,
    executionCasesMap: Map<number, any[]>
  }
) => {
  const { smsMap, marksMap, commentsMap, committeeMap, chargesMap, courtCasesMap, executionCasesMap } = activityMaps;

  return targets.map(target => {
    const loans: any[] = [];
    const sms: any[] = [];
    const marks: any[] = [];
    const comments: any[] = [];
    const committeeRequests: any[] = [];
    const charges: any[] = [];
    const courtCases: any[] = [];
    const executionCases: any[] = [];

    // Extract loans and their related activity
    for (const junction of target.CollectorMonthlyTargetLoan) {
      const loan = junction.Loan;
      loans.push(loan);

      // Get activity data from maps
      const loanId = loan.id;
      if (smsMap.has(loanId)) sms.push(...smsMap.get(loanId)!);
      if (marksMap.has(loanId)) marks.push(...marksMap.get(loanId)!);
      if (commentsMap.has(loanId)) comments.push(...commentsMap.get(loanId)!);
      if (committeeMap.has(loanId)) committeeRequests.push(...committeeMap.get(loanId)!);
      if (chargesMap.has(loanId)) charges.push(...chargesMap.get(loanId)!);
      if (courtCasesMap.has(loanId)) courtCases.push(...courtCasesMap.get(loanId)!);
      if (executionCasesMap.has(loanId)) executionCases.push(...executionCasesMap.get(loanId)!);
    }

    return {
      target,
      collectionData: { loans, sms, marks, comments, committeeRequests, charges, courtCases, executionCases }
    };
  });
};
