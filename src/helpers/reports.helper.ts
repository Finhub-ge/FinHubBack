import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const prepareDataForInsert = (parsedData: any[]) => {
  return parsedData
    .filter(row => row.collectorId && row.year && row.month && row.targetAmount)
    .map(row => ({
      collectorId: Number(row.collectorId),
      targetAmount: Number(row.targetAmount),
      year: Number(row.year),
      month: Number(row.month),
    }));
}

export const fetchExistingReports = async (dataToInsert: any[], collectorIds: number[]) => {
  const years = [...new Set(dataToInsert.map(d => d.year))];
  const months = [...new Set(dataToInsert.map(d => d.month))];

  return await prisma.collectorMonthlyReport.findMany({
    where: {
      collectorId: { in: collectorIds },
      year: { in: years },
      month: { in: months },
    },
    select: { collectorId: true, year: true, month: true, status: true },
  });
}

export const calculateCollectorLoanStats = async (collectorIds: number[]) => {
  const uploadDate = new Date();

  const allAssignments = await prisma.loanAssignment.findMany({
    where: {
      userId: { in: collectorIds },
      assignedAt: { lte: uploadDate },
      OR: [{ unassignedAt: null }, { unassignedAt: { gte: uploadDate } }],
      Loan: {
        closedAt: null
      }
    },
    select: { userId: true, loanId: true },
  });

  const assignmentsByCollector = allAssignments.reduce((acc, a) => {
    if (!acc[a.userId]) acc[a.userId] = new Set();
    acc[a.userId].add(a.loanId);
    return acc;
  }, {} as Record<number, Set<number>>);

  const allLoanIds = [...new Set(allAssignments.map(a => a.loanId))];
  const loanDetails = await getLoanDetailsWithStatusName(allLoanIds);

  const collectorStats = new Map();

  for (const collectorId of collectorIds) {
    const loanIds = assignmentsByCollector[collectorId];

    const stats = {
      totalPrincipal: 0,
      totalCount: 0,
      byStatusName: {} as Record<string, number>,
    };

    if (loanIds) {
      for (const loanId of loanIds) {
        const loan = loanDetails.get(loanId);
        if (!loan) continue;

        stats.totalPrincipal += loan.principal;
        stats.totalCount++;

        const statusName = loan.statusName;
        if (statusName) {
          if (!stats.byStatusName[statusName]) {
            stats.byStatusName[statusName] = 0;
          }
          stats.byStatusName[statusName]++;
        }
      }
    }

    collectorStats.set(collectorId, stats);
  }

  return collectorStats;
}


export const getLoanDetailsWithStatusName = async (loanIds: number[]) => {
  if (loanIds.length === 0) return new Map();

  const loans = await prisma.loan.findMany({
    where: { id: { in: loanIds } },
    select: {
      id: true,
      principal: true,
      LoanStatus: {
        select: {
          name: true
        }
      }
    },
  });

  return new Map(
    loans.map(l => [
      l.id,
      {
        principal: Number(l.principal) || 0,
        statusName: l.LoanStatus?.name || null
      },
    ])
  );
}

const STATUS_TO_FIELD_MAP: Record<string, string> = {
  'New': 'newLoanCount',
  'Agreement': 'agreementCount',
  'Communicated': 'communicatedCount',
  'Unreachable': 'unreachableCount',
  'Agreement Cancelled': 'agreementCancelledCount',
  'Refuse To Pay': 'refuseToPayCount',
  'Promised To Pay': 'promiseToPayCount',
};

export const separateCreatesAndUpdates = (
  dataToInsert: any[],
  existingReports: any[],
  frozenKeys: Set<string>,
  collectorStats: Map<number, any>,
  userId: number
) => {
  const toCreate = [];
  const toUpdate = [];

  for (const row of dataToInsert) {
    const { collectorId, targetAmount, year, month } = row;
    const key = `${collectorId}-${year}-${month}`;

    if (frozenKeys.has(key)) continue;

    const stats = collectorStats.get(collectorId);

    // Map status names to report field names
    const statusFields = {};
    if (stats?.byStatusName) {
      for (const [statusName, count] of Object.entries(stats.byStatusName)) {
        const fieldName = STATUS_TO_FIELD_MAP[statusName];
        if (fieldName) {
          statusFields[fieldName] = count;
        }
      }
    }

    const recordData = {
      collectorId,
      year,
      month,
      monthlyPlan: targetAmount,
      adjustedPlan: targetAmount,
      openingPrincipal: stats?.totalPrincipal || 0,
      totalLoanCount: stats?.totalCount || 0,
      ...statusFields,
    };

    const exists = existingReports.some(
      r => r.collectorId === collectorId && r.year === year && r.month === month
    );

    if (exists) {
      toUpdate.push(recordData);
    } else {
      toCreate.push({
        ...recordData,
        status: 'ACTIVE',
        generatedBy: userId,
      });
    }
  }

  return { toCreate, toUpdate };
}

export const executeBatchOperations = async (toCreate: any[], toUpdate: any[]) => {
  const operations = [];

  // Batch create
  if (toCreate.length > 0) {
    operations.push(
      prisma.collectorMonthlyReport.createMany({
        data: toCreate,
        skipDuplicates: true,
      })
    );
  }

  // Batch update
  for (const record of toUpdate) {
    operations.push(
      prisma.collectorMonthlyReport.updateMany({
        where: {
          collectorId: record.collectorId,
          year: record.year,
          month: record.month,
          status: { not: 'FROZEN' },
        },
        data: {
          monthlyPlan: record?.monthlyPlan,
          adjustedPlan: record?.adjustedPlan,
          openingPrincipal: record?.openingPrincipal,
          totalLoanCount: record?.totalLoanCount,
          newLoanCount: record?.newLoanCount || 0,
          agreementCount: record?.agreementCount || 0,
          communicatedCount: record?.communicatedCount || 0,
          unreachableCount: record?.unreachableCount || 0,
          agreementCancelledCount: record?.agreementCancelledCount || 0,
          refuseToPayCount: record?.refuseToPayCount || 0,
          promiseToPayCount: record?.promiseToPayCount || 0,
          updatedAt: new Date(),
        },
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}