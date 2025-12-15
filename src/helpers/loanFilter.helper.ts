// loan.helper.ts

import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import { buildLoanSearchWhere, calculateWriteoff } from './loan.helper';
import { getLatestLoanIds } from './loan.helper';
import { idToStatus } from 'src/enums/visitStatus.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { subtractDays } from "./date.helper";

dayjs.extend(utc);
dayjs.extend(timezone);

// ==================== FILTER BUILDERS ====================

export const buildInitialWhereClause = () => {
  return { deletedAt: null, closedAt: null };
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

  const searchConditions = buildLoanSearchWhere(searchTerm);
  where.AND = where.AND || [];
  where.AND.push({ OR: searchConditions });
};

export const applyPortfolioFilters = (where: any, filters: any): void => {
  if (filters.portfolio?.length) {
    where.groupId = { in: filters.portfolio };
  }

  if (filters.portfolioseller?.length) {
    where.Portfolio = {
      portfolioSeller: { id: { in: filters.portfolioseller } },
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
  if (actDays) {
    const targetDate = subtractDays(new Date(), actDays);
    const nextDay = subtractDays(new Date(), actDays - 1);

    where.lastActivite = {
      gte: targetDate,
      lt: nextDay
    };
  }
};

export const applyUserFilterRestrictions = (filters: any, user: any, teamMemberIds?: number[]): any => {
  // Import helper functions from loan.helper
  const { getActiveTeamMembership, isTeamLead } = require('./loan.helper');

  // Admin and Super Admin can see everything without restrictions
  if (user.role_name === 'super_admin' || user.role_name === 'admin') {
    return filters;
  }

  const activeTeamMembership = getActiveTeamMembership(user);
  const teamLead = isTeamLead(user);
  const restrictedFilters = { ...filters };

  // Handle COLLECTOR role
  if (user.role_name === 'collector') {
    if (teamLead && activeTeamMembership && teamMemberIds) {
      // Collector Team Lead: Can filter by assigneduser, but only team members
      // Validate and restrict assigneduser to only include team member IDs
      if (restrictedFilters.assigneduser && Array.isArray(restrictedFilters.assigneduser)) {
        // Filter to only include IDs that are in the team
        restrictedFilters.assigneduser = restrictedFilters.assigneduser.filter(
          (userId: number) => teamMemberIds.includes(userId)
        );

        // If after filtering, no valid users remain, remove the filter
        if (restrictedFilters.assigneduser.length === 0) {
          delete restrictedFilters.assigneduser;
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
    if (teamLead && activeTeamMembership) {
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

  const assignedUserIds = collectAssignedUserIds(restrictedFilters);

  if (assignedUserIds.length === 0) return;

  where.LoanAssignment = {
    some: {
      isActive: true,
      User: { id: { in: assignedUserIds } },
    },
  };
};

export const collectAssignedUserIds = (filters: any): number[] => {
  return [
    ...(filters.assigneduser || []),
    ...(filters.assignedlawyer || []),
    ...(filters.assignedjuniorLawyer || []),
    ...(filters.assignedexecutionLawyer || []),
  ];
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


export const fetchLatestRecordFilterIds = async (
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

// ==================== DATA ENRICHMENT ====================

export const mapClosedLoansDataToPaymentWriteoff = async (
  loans: any[],
  paymentsHelper: any
): Promise<void> => {
  await Promise.all([
    Promise.all(loans.map(async (loan) => {
      loan.remainingChanges = await calculateWriteoff(loan.publicId, paymentsHelper);
    }))
  ]);
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