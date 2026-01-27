// loan.helper.ts

import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import { buildLoanSearchWhere, calculateWriteoff, getActiveTeamMembership, isRegionalManager, isTeamLead } from './loan.helper';
import { getLatestLoanIds } from './loan.helper';
import { idToStatus } from 'src/enums/visitStatus.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { subtractDays } from "./date.helper";

dayjs.extend(utc);
dayjs.extend(timezone);

// ==================== FILTER BUILDERS ====================

export const buildInitialWhereClause = () => {
  return { deletedAt: null };
};

export const applyClosedLoansFilter = (where: any, filters: any): void => {
  where.statusId = { in: LoanStatusGroups.CLOSED };
  where.closedAt = { not: null };
  applySearchFilter(where, filters.search);
  applyPortfolioFilters(where, filters);
};

export const applyOpenLoansFilter = (
  where: any,
  filters: any,
  showClosedLoans: boolean
): void => {
  if (!showClosedLoans && !filters.search) {
    where.statusId = { notIn: LoanStatusGroups.CLOSED };
  }
};

export const applyCommonFilters = (where: any, filters: any): void => {
  applySearchFilter(where, filters.search);
  applyPortfolioFilters(where, filters);
  applyStatusFilter(where, filters.loanstatus);
  applyClientStatusFilter(where, filters.clientStatus);
  applyActDaysFilter(where, filters.actDays);
};

export const applySearchFilter = (where: any, searchTerm?: string): void => {
  if (!searchTerm) return;

  const { conditions, isGlobalSearch } = buildLoanSearchWhere(searchTerm);
  // console.log(searchConditions);
  where.AND = where.AND || [];
  where.AND.push({ OR: conditions });
  // Mark as global search if needed
  if (isGlobalSearch) {
    where._isGlobalSearch = true;
  }

  //exclude CLOSED only for NON-global search
  if (!isGlobalSearch) {
    where.AND.push({
      statusId: {
        notIn: LoanStatusGroups.CLOSED as unknown as number[],
      },
    });
  }

  delete where.closedAt;
};

export const applyPortfolioFilters = (where: any, filters: any): void => {
  if (filters.portfolio?.length) {
    where.groupId = { in: filters.portfolio };
  }

  if (filters.portfolioseller?.length) {
    where.Portfolio = {
      id: { in: filters.portfolioseller },
    };
  }
};

export const applyStatusFilter = (where: any, loanStatuses?: number[]): void => {
  if (loanStatuses?.length) {
    where.statusId = { in: loanStatuses };
  }
};

export const applyClientStatusFilter = (where: any, clientStatuses?: number[]): void => {
  if (clientStatuses?.length) {
    where.Debtor = {
      DebtorStatus: { id: { in: clientStatuses } },
    };
  }
};

export const applyActDaysFilter = (where: any, actDays?: number): void => {
  if (typeof actDays === 'number') {
    const targetDate = subtractDays(new Date(), actDays);
    const nextDay = subtractDays(new Date(), actDays - 1);

    where.lastActivite = {
      gte: targetDate,
      lt: nextDay
    };
  }
};

export const applyUserFilterRestrictions = (filters: any, user: any, teamMemberIds?: number[]): any => {
  // Admin and Super Admin can see everything without restrictions
  if (user.role_name === 'super_admin' || user.role_name === 'admin' || user.role_name === 'operational_manager') {
    return filters;
  }

  const activeTeamMembership = getActiveTeamMembership(user);
  const teamLead = isTeamLead(user);
  const regionalManager = isRegionalManager(user);
  const restrictedFilters = { ...filters };

  // Handle COLLECTOR role
  if (user.role_name === 'collector') {
    // Team leads or regional managers can filter by assigneduser
    if ((teamLead && activeTeamMembership) || regionalManager) {
      if (teamMemberIds) {
        // Can filter by assigneduser, but only team/region members
        // Validate and restrict assigneduser to only include allowed member IDs
        if (restrictedFilters.assigneduser && Array.isArray(restrictedFilters.assigneduser)) {
          // Filter to only include IDs that are in the team/region
          restrictedFilters.assigneduser = restrictedFilters.assigneduser.filter(
            (userId: number) => teamMemberIds.includes(userId)
          );

          // If after filtering, no valid users remain, remove the filter
          if (restrictedFilters.assigneduser.length === 0) {
            delete restrictedFilters.assigneduser;
          }
        }
      }
    } else {
      // Collector (Not Team Lead): Remove assigneduser filter completely
      delete restrictedFilters.assigneduser;
    }
  }

  // Handle LAWYER roles (lawyer, junior_lawyer, execution_lawyer, super_lawyer)
  const lawyerRoles = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'];
  if (lawyerRoles.includes(user.role_name)) {
    if ((teamLead && activeTeamMembership) || regionalManager) {
      // Lawyer Team Lead: Can filter by any lawyer (no restrictions)
      // Allow all lawyer filters to pass through
    } else {
      // Lawyer (Not Team Lead): Remove all lawyer filters
      delete restrictedFilters.assignedlawyer;
      delete restrictedFilters.assignedjuniorLawyer;
      delete restrictedFilters.assignedexecutionLawyer;
    }
  }

  return restrictedFilters;
};

export const applyUserAssignmentFilter = (where: any, filters: any, user?: any, teamMemberIds?: number[]): void => {
  // If user is provided, apply filter restrictions based on role
  const restrictedFilters = user ? applyUserFilterRestrictions(filters, user, teamMemberIds) : filters;

  // Collect all assignment filter IDs
  const allLawyerIds = [
    ...(restrictedFilters.assignedlawyer || []),
    ...(restrictedFilters.assignedjuniorLawyer || []),
    ...(restrictedFilters.assignedexecutionLawyer || []),
  ];

  const collectorIds = restrictedFilters.assigneduser || [];

  // Check for special IDs
  const hasUnassigned = allLawyerIds.includes(-1);  // None
  const hasPending = allLawyerIds.includes(-2);      // Pending

  // Get real user IDs (exclude special IDs)
  const realLawyerIds = allLawyerIds.filter(id => id > 0);
  const realCollectorIds = collectorIds.filter(id => id > 0);
  const realUserIds = [...realLawyerIds, ...realCollectorIds];

  // Build conditions array for OR logic
  const conditions = [];

  // 1. Add condition for unassigned lawyers (-1)
  if (hasUnassigned) {
    conditions.push({
      LoanAssignment: {
        none: {
          isActive: true,
          Role: {
            name: {
              in: ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer']
            }
          }
        }
      }
    });
  }

  // 2. Add condition for pending requests (-2)
  if (hasPending) {
    conditions.push({
      LawyerRequest: {
        status: 'PENDING'
      }
    });
  }

  // 3. Add condition for real user assignments
  if (realUserIds.length > 0) {
    conditions.push({
      LoanAssignment: {
        some: {
          isActive: true,
          User: { id: { in: realUserIds } }
        }
      }
    });
  }

  // Apply the conditions
  if (conditions.length > 1) {
    // Multiple conditions: use OR
    where.OR = conditions;
  } else if (conditions.length === 1) {
    // Single condition: merge directly
    Object.assign(where, conditions[0]);
  }
  // If no conditions, don't add any filter
};

export const collectAssignedUserIds = (filters: any): number[] => {
  return [
    ...(filters.assigneduser || []),
    ...(filters.assignedlawyer || []),
    ...(filters.assignedjuniorLawyer || []),
    ...(filters.assignedexecutionLawyer || []),
  ];
};

export const hasLoanAssignmentInWhere = (where: any): boolean => {
  if (!where) return false;

  // Check if LoanAssignment filter already exists in where clause
  if (where.LoanAssignment) {
    return true;
  }

  // Check in OR conditions
  if (Array.isArray(where.OR)) {
    for (const condition of where.OR) {
      if (condition.LoanAssignment) {
        return true;
      }
    }
  }

  // Check in AND conditions
  if (Array.isArray(where.AND)) {
    for (const condition of where.AND) {
      if (condition.LoanAssignment) {
        return true;
      }
    }
  }

  return false;
};

export const applyClosedDateRangeFilter = (where: any, filters: any): void => {
  if (!filters.closedDateStart && !filters.closedDateEnd) return;

  const dateRange: any = {};

  if (filters.closedDateStart) {
    dateRange.gte = dayjs(filters.closedDateStart).startOf('day').toDate();
  }

  if (filters.closedDateEnd) {
    dateRange.lte = dayjs(filters.closedDateEnd).endOf('day').toDate();
  }

  where.closedAt = dateRange;
};

// ==================== COMPLEX FILTERS ====================


export const fetchLatestRecordFilterIds1 = async (
  prisma: PrismaService,
  filters: any
): Promise<Map<string, number[]>> => {
  const results = new Map<string, number[]>();

  // Collateral status
  if (filters.collateralstatus?.length) {
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanCollateralStatus',
      'collateralStatus',
      filters.collateralstatus
    );
    results.set('collateralstatus', ids);
  }

  // City
  if (filters.city?.length) {
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanAddress',
      'city',
      filters.city
    );
    results.set('city', ids);
  }

  // Visit status
  if (filters.visitStatus?.length) {
    const statusStrings = mapVisitStatusIds(filters.visitStatus);
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanVisit',
      'status',
      statusStrings
    );
    results.set('visitStatus', ids);
  }

  // Litigation stage
  if (filters.litigationstage?.length) {
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanLitigationStage',
      'litigationStage',
      filters.litigationstage
    );
    results.set('litigationstage', ids);
  }

  // Legal stage
  if (filters.legalstage?.length) {
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanLegalStage',
      'legalStage',
      filters.legalstage
    );
    results.set('legalstage', ids);
  }

  // Marks
  if (filters.marks?.length) {
    const ids = await getLatestLoanIdsByField(
      prisma,
      'LoanMarks',
      'mark',
      filters.marks
    );
    results.set('marks', ids);
  }

  return results;
};

export const fetchLatestRecordFilterIds = async (
  prisma: PrismaService,
  filters: any
): Promise<Map<string, number[]>> => {
  // Build array of promises to execute in parallel
  const filterPromises: Array<{ key: string; promise: Promise<number[]> }> = [];

  // Collateral status
  if (filters.collateralstatus?.length) {
    filterPromises.push({
      key: 'collateralstatus',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanCollateralStatus',
        'collateralStatus',
        filters.collateralstatus
      )
    });
  }

  // City
  if (filters.city?.length) {
    filterPromises.push({
      key: 'city',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanAddress',
        'city',
        filters.city
      )
    });
  }

  // Visit status
  if (filters.visitStatus?.length) {
    const statusStrings = mapVisitStatusIds(filters.visitStatus);
    filterPromises.push({
      key: 'visitStatus',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanVisit',
        'status',
        statusStrings
      )
    });
  }

  // Litigation stage
  if (filters.litigationstage?.length) {
    filterPromises.push({
      key: 'litigationstage',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanLitigationStage',
        'litigationStage',
        filters.litigationstage
      )
    });
  }

  // Legal stage
  if (filters.legalstage?.length) {
    filterPromises.push({
      key: 'legalstage',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanLegalStage',
        'legalStage',
        filters.legalstage
      )
    });
  }

  // Marks
  if (filters.marks?.length) {
    filterPromises.push({
      key: 'marks',
      promise: getLatestLoanIdsByField(
        prisma,
        'LoanMarks',
        'mark',
        filters.marks
      )
    });
  }

  // Execute all filter queries in parallel
  const filterResults = await Promise.all(filterPromises.map(fp => fp.promise));

  // Map results back to their keys
  const results = new Map<string, number[]>();
  filterPromises.forEach((fp, index) => {
    results.set(fp.key, filterResults[index]);
  });

  return results;
};

export const getLatestLoanIdsByField = async (
  prisma: PrismaService,
  tableName: string,
  fieldName: string,
  values: any[]
): Promise<number[]> => {
  return getLatestLoanIds(prisma, tableName, fieldName, values);
};

export const mapVisitStatusIds = (statusIds: number[]): string[] => {
  return statusIds.map((id) => idToStatus[Number(id)]).filter(Boolean);
};

export const applyIntersectedIds = (where: any, loanIds: number[]): void => {
  if (loanIds.length > 0) {
    where.id = { in: loanIds };
  }
};

// ==================== COMPLEX FILTERS ====================

export const shouldProcessIntersection = (filterResults: Map<string, number[]>): boolean => {
  return filterResults.size > 0;
};

export const hasEmptyFilterResults = (filterResults: Map<string, number[]>): boolean => {
  if (filterResults.size === 0) return false;
  return [...filterResults.values()].some((ids) => ids.length === 0);
};

export const calculateLoanIdIntersection = (
  filterResults: Map<string, number[]>
): number[] => {
  if (filterResults.size === 0) return []; // This is fine, but we need to check before calling

  const allFilterIds = [...filterResults.values()];
  let intersection = allFilterIds[0];

  for (const ids of allFilterIds) {
    intersection = intersection.filter((id) => ids.includes(id));
  }

  return intersection;
};

// ==================== QUERY CONFIGURATION ====================

export const getLoanIncludeConfig1 = () => {
  return {
    Portfolio: {
      select: {
        id: true,
        name: true,
        portfolioSeller: { select: { id: true, name: true } },
      },
    },
    PortfolioCaseGroup: {
      select: { id: true, groupName: true },
    },
    Debtor: {
      select: {
        firstName: true,
        lastName: true,
        idNumber: true,
        DebtorStatus: { select: { id: true, name: true } },
        _count: {
          select: { Loan: true }  // This counts all loans for this debtor
        }
      },
    },
    LoanStatus: {
      select: { id: true, name: true },
    },
    LoanStatusHistory: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        newStatusId: true,
        createdAt: true,
      },
      take: 1,
    },
    LoanAssignment: {
      where: { isActive: true },
      select: {
        createdAt: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        Role: { select: { name: true } },
      },
    },
    LoanCollateralStatus: getLatestRecordConfig('CollateralStatus'),
    LoanLitigationStage: getLatestRecordConfig('LitigationStage'),
    LoanLegalStage: getLatestRecordConfig('LegalStage'),
    LoanMarks: getLatestRecordConfig('Marks'),
    LoanAddress: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        address: true,
        type: true,
        City: { select: { id: true, city: true } },
      },
    },
    LoanVisit: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      where: { deletedAt: null },
      select: {
        id: true,
        status: true,
        comment: true,
        LoanAddress: { select: { id: true, address: true } },
      },
    },
    LoanRemaining: {
      where: { deletedAt: null },
    },
    LawyerRequest: true,
  };
};

export const getLoanIncludeConfig = () => {
  return {
    Portfolio: {
      select: {
        id: true,
        name: true,
        portfolioSeller: { select: { id: true, name: true } },
      },
    },
    PortfolioCaseGroup: {
      select: { id: true, groupName: true },
    },
    Debtor: {
      select: {
        firstName: true,
        lastName: true,
        idNumber: true,
        DebtorStatus: { select: { id: true, name: true } },
        _count: {
          select: { Loan: true }  // This counts all loans for this debtor
        }
      },
    },
    LoanStatus: {
      select: { id: true, name: true },
    },
    LoanAssignment: {
      where: { isActive: true },
      select: {
        createdAt: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        Role: { select: { name: true } },
      },
    },
    LoanRemaining: {
      where: { deletedAt: null },
    },
    LawyerRequest: true,
    Transaction: {
      where: { deleted: 0 },
      select: {
        paymentDate: true,
        amount: true,
      },
      orderBy: { paymentDate: 'desc' },
      take: 1,
    },
    // NOTE: Latest records (LoanStatusHistory, LoanCollateralStatus, etc.)
    // are loaded separately via batchLoadLatestRecords() for performance
  };
};

export const getLatestRecordConfig = (relationName: string) => {
  return {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      [relationName]: { select: { id: true, title: true } },
    },
  };
};

// ==================== BATCH LOADING LATEST RECORDS ====================


export const batchLoadLatestRecords = async (
  prisma: PrismaService,
  loanIds: number[]
): Promise<{
  statusHistory: Map<number, any>;
  collateralStatus: Map<number, any>;
  litigationStage: Map<number, any>;
  legalStage: Map<number, any>;
  marks: Map<number, any>;
  addresses: Map<number, any>;
  visits: Map<number, any>;
}> => {
  if (loanIds.length === 0) {
    return {
      statusHistory: new Map(),
      collateralStatus: new Map(),
      litigationStage: new Map(),
      legalStage: new Map(),
      marks: new Map(),
      addresses: new Map(),
      visits: new Map(),
    };
  }

  // Execute all queries in parallel - 7 queries total instead of N×6
  const [
    statusHistoryRecords,
    collateralStatusRecords,
    litigationStageRecords,
    legalStageRecords,
    marksRecords,
    addressRecords,
    visitRecords,
  ] = await Promise.all([
    // Latest status history
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lsh.*
      FROM LoanStatusHistory lsh
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanStatusHistory
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lsh.loanId = latest.loanId AND lsh.createdAt = latest.maxCreated
      WHERE lsh.deletedAt IS NULL
    `),

    // Latest collateral status
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lcs.*, cs.id as collateralStatusId, cs.title as collateralStatusTitle
      FROM LoanCollateralStatus lcs
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanCollateralStatus
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lcs.loanId = latest.loanId AND lcs.createdAt = latest.maxCreated
      INNER JOIN CollateralStatus cs ON lcs.collateralStatusId = cs.id
      WHERE lcs.deletedAt IS NULL
    `),

    // Latest litigation stage
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lls.*, ls.id as litigationStageId, ls.title as litigationStageTitle
      FROM LoanLitigationStage lls
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanLitigationStage
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lls.loanId = latest.loanId AND lls.createdAt = latest.maxCreated
      INNER JOIN LitigationStage ls ON lls.litigationStageId = ls.id
      WHERE lls.deletedAt IS NULL
    `),

    // Latest legal stage
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lls.*, ls.id as legalStageId, ls.title as legalStageTitle
      FROM LoanLegalStage lls
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanLegalStage
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lls.loanId = latest.loanId AND lls.createdAt = latest.maxCreated
      INNER JOIN LegalStage ls ON lls.legalStageId = ls.id
      WHERE lls.deletedAt IS NULL
    `),

    // Latest marks
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lm.*, m.id as markId, m.title as markTitle
      FROM LoanMarks lm
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanMarks
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lm.loanId = latest.loanId AND lm.createdAt = latest.maxCreated
      INNER JOIN Marks m ON lm.markId = m.id
      WHERE lm.deletedAt IS NULL
    `),

    // Latest address
    prisma.$queryRawUnsafe<any[]>(`
      SELECT la.*, c.id as cityId, c.city as cityName
      FROM LoanAddress la
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanAddress
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON la.loanId = latest.loanId AND la.createdAt = latest.maxCreated
      INNER JOIN City c ON la.cityId = c.id
      WHERE la.deletedAt IS NULL
    `),

    // Latest visit
    prisma.$queryRawUnsafe<any[]>(`
      SELECT lv.*, la.id as addressId, la.address as addressText
      FROM LoanVisit lv
      INNER JOIN (
        SELECT loanId, MAX(createdAt) as maxCreated
        FROM LoanVisit
        WHERE loanId IN (${loanIds.join(',')}) AND deletedAt IS NULL
        GROUP BY loanId
      ) latest ON lv.loanId = latest.loanId AND lv.createdAt = latest.maxCreated
      LEFT JOIN LoanAddress la ON lv.loanAddressId = la.id
      WHERE lv.deletedAt IS NULL
    `),
  ]);

  // Convert arrays to Maps for O(1) lookup
  return {
    statusHistory: new Map(statusHistoryRecords.map(r => [r.loanId, r])),
    collateralStatus: new Map(collateralStatusRecords.map(r => [r.loanId, r])),
    litigationStage: new Map(litigationStageRecords.map(r => [r.loanId, r])),
    legalStage: new Map(legalStageRecords.map(r => [r.loanId, r])),
    marks: new Map(marksRecords.map(r => [r.loanId, r])),
    addresses: new Map(addressRecords.map(r => [r.loanId, r])),
    visits: new Map(visitRecords.map(r => [r.loanId, r])),
  };
};

/**
 * Attach latest records to loans (maps data to Prisma format)
 */
export const attachLatestRecordsToLoans = (
  loans: any[],
  latestRecords: Awaited<ReturnType<typeof batchLoadLatestRecords>>
): void => {
  for (const loan of loans) {
    const loanId = loan.id;

    // Attach status history
    const statusHistory = latestRecords.statusHistory.get(loanId);
    loan.LoanStatusHistory = statusHistory ? [{
      id: statusHistory.id,
      newStatusId: statusHistory.newStatusId,
      createdAt: statusHistory.createdAt,
    }] : [];

    // Attach collateral status
    const collateralStatus = latestRecords.collateralStatus.get(loanId);
    loan.LoanCollateralStatus = collateralStatus ? [{
      CollateralStatus: {
        id: collateralStatus.collateralStatusId,
        title: collateralStatus.collateralStatusTitle,
      }
    }] : [];

    // Attach litigation stage
    const litigationStage = latestRecords.litigationStage.get(loanId);
    loan.LoanLitigationStage = litigationStage ? [{
      LitigationStage: {
        id: litigationStage.litigationStageId,
        title: litigationStage.litigationStageTitle,
      }
    }] : [];

    // Attach legal stage
    const legalStage = latestRecords.legalStage.get(loanId);
    loan.LoanLegalStage = legalStage ? [{
      LegalStage: {
        id: legalStage.legalStageId,
        title: legalStage.legalStageTitle,
      }
    }] : [];

    // Attach marks
    const marks = latestRecords.marks.get(loanId);
    loan.LoanMarks = marks ? [{
      Marks: {
        id: marks.markId,
        title: marks.markTitle,
      }
    }] : [];

    // Attach address
    const address = latestRecords.addresses.get(loanId);
    loan.LoanAddress = address ? [{
      id: address.id,
      address: address.address,
      type: address.type,
      City: {
        id: address.cityId,
        city: address.cityName,
      }
    }] : [];

    // Attach visit
    const visit = latestRecords.visits.get(loanId);
    loan.LoanVisit = visit ? [{
      id: visit.id,
      status: visit.status,
      comment: visit.comment,
      LoanAddress: visit.addressId ? {
        id: visit.addressId,
        address: visit.addressText,
      } : null,
    }] : [];
  }
};

// ==================== DATA ENRICHMENT ====================

export const mapClosedLoansDataToPaymentWriteoff1 = async (
  loans: any[],
  paymentsHelper: any
): Promise<void> => {
  for (const loan of loans) {
    loan.remainingChanges = await calculateWriteoff(
      loan,
      paymentsHelper
    );
  }
};

export const batchCalculateWriteoffs = async (
  loans: any[],
  paymentsHelper: any
): Promise<void> => {
  if (loans.length === 0) return;

  const toNumber = (v: any) => Number(v) || 0;

  // 1. Batch fetch all transaction totals in ONE query (instead of N queries)
  const loanIds = loans.map(loan => loan.id);
  const paymentsMap = await paymentsHelper.getBatchedTotalPaymentsByLoanIds(loanIds);

  // 2. Calculate writeoffs for each loan (in memory, no queries)
  loans.forEach(loan => {
    const totalPayments = paymentsMap.get(loan.id) || {
      totalPayments: 0,
      paidPrincipal: 0,
      paidInterest: 0,
      paidPenalty: 0,
      paidOtherFee: 0,
      paidLegalCharges: 0,
    };

    const initPrincipal = toNumber(loan.principal);
    const initInterest = toNumber(loan.interest);
    const initPenalty = toNumber(loan.penalty);
    const initOtherFee = toNumber(loan.otherFee);
    const initLegalCharges = toNumber(loan.legalCharges);
    const initDebt = toNumber(loan.totalDebt);

    const totalPaidPrincipal = toNumber(totalPayments.paidPrincipal);
    const totalPaidInterest = toNumber(totalPayments.paidInterest);
    const totalPaidPenalty = toNumber(totalPayments.paidPenalty);
    const totalPaidOtherFee = toNumber(totalPayments.paidOtherFee);
    const totalPaidLegalCharges = toNumber(totalPayments.paidLegalCharges);
    const totalPaymentsAmount = toNumber(totalPayments.totalPayments);

    loan.remainingChanges = {
      principal: initPrincipal - totalPaidPrincipal,
      interest: initInterest - totalPaidInterest,
      penalty: initPenalty - totalPaidPenalty,
      otherFee: initOtherFee - totalPaidOtherFee,
      legalCharges: initLegalCharges - totalPaidLegalCharges,
      totalWriteOff: initDebt - totalPaymentsAmount,
    };
  });
};

export const mapClosedLoansDataToPaymentWriteoff = async (
  loans: any[],
  paymentsHelper: any
): Promise<void> => {
  // Use optimized batch version
  await batchCalculateWriteoffs(loans, paymentsHelper);
}

export const hasAssignmentFilters = (filters: any): boolean => {
  return !!(
    filters.assigneduser?.length ||
    filters.assignedlawyer?.length ||
    filters.assignedjuniorLawyer?.length ||
    filters.assignedexecutionLawyer?.length
  );
};

export const hasDateRangeFilter = (filters: any): boolean => {
  return !!(filters.closedDateStart || filters.closedDateEnd);
};

// ==================== QUERY BUILDERS ====================

export const buildLoanQuery = (
  where: any,
  paginationParams: any,
  includeConfig: any
) => {
  return {
    where,
    ...paginationParams,
    // orderBy: { actDays: 'desc' as const },
    orderBy: { lastActivite: 'asc' },
    include: includeConfig,
  };
};

export const buildCountQuery = (where: any) => {
  return { where };
};