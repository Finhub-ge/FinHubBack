import { Prisma, PrismaClient, Reminders_type, TeamMembership_teamRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import * as dayjs from "dayjs";
import { statusToId } from "src/enums/visitStatus.enum";
import { BadRequestException } from "@nestjs/common";
import { PaymentScheduleItemDto } from "src/loan/dto/updateLoanStatus.dto";
import { daysFromDate, subtractDays } from "./date.helper";
import { LoanStatusGroups } from "src/enums/loanStatus.enum";
const prisma = new PrismaClient();

export interface LogAssignmentHistoryOptions {
  prisma: PrismaService;
  loanId: number;
  userId: number;
  roleId: number;
  action: 'assigned' | 'unassigned';
  assignedBy: number;
}

export const logAssignmentHistory = async (data: LogAssignmentHistoryOptions) => {
  const { prisma, loanId, userId, roleId, action, assignedBy } = data;

  await prisma.loanAssignmentHistory.create({
    data: {
      loanId,
      userId,
      roleId,
      action,
      createdBy: assignedBy,
    },
  });
};

export const getPaymentSchedule = async (loanId: number) => {
  const commitments = await prisma.paymentCommitment.findMany({
    where: { loanId, isActive: 1 },
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      type: true,
      comment: true,
      isActive: true,
      PaymentSchedule: {
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          status: true,
          paidAmount: true,
          paidDate: true,
        },
        orderBy: {
          paymentDate: 'asc',
        },
      },
    },
  });

  return commitments.map((commitment) => {
    let balance = Number(commitment.amount);

    const schedulesWithBalance = commitment.PaymentSchedule.map((s) => {
      balance -= Number(s.amount);
      return {
        ...s,
        balance,
      };
    });

    return {
      ...commitment,
      PaymentSchedule: schedulesWithBalance,
    };
  });
}

export const handleCommentsForReassignment = async (loanId: number, roleId: number, userId: number, assignedBy: number, currentAssignment: any, tx?: any) => {
  const dbClient = tx || prisma; // Use transaction if provided, otherwise use main prisma

  if (!currentAssignment) {
    return;
  }
  await archiveCommentsForUser(loanId, roleId, currentAssignment.userId, assignedBy, dbClient);
}

export const getCurrentAssignment = async (loanId: number, roleId: number, dbClient: any) => {
  return dbClient.loanAssignment.findFirst({
    where: {
      loanId,
      roleId,
      isActive: true,
      deletedAt: null,
    }
  });
}

export const archiveCommentsForUser = async (loanId: number, roleId: number, userId: number, archivedBy: number, dbClient: any) => {
  const commentsToArchive = await dbClient.comments.updateMany({
    where: {
      loanId: loanId,
      userId: userId,
      archived: false,
      deletedAt: null,
      User: {
        roleId: roleId  // Filter by role instead of specific userId
      }
    },
    data: {
      archived: true,
      archivedAt: new Date(),
      archivedBy: archivedBy
    }
  });
  return commentsToArchive;
}

export const getActiveTeamMembership = (user: any) => {
  return user.team_membership?.find(tm => tm.deletedAt === null);
}

export const isTeamLead = (user: any): boolean => {
  const activeTeamMembership = getActiveTeamMembership(user);
  return activeTeamMembership?.teamRole === TeamMembership_teamRole.leader;
}

export const buildCommentsWhereClause = async (prisma: PrismaService, user: any, loanPublicId: string) => {
  const teamLead = isTeamLead(user);
  const isCollector = user.role_name === 'collector';

  const getUserTeamLead = await prisma.teamMembership.findFirst({
    where: {
      teamId: user.team_membership[0].teamId,
      deletedAt: null,
      teamRole: TeamMembership_teamRole.leader
    },
    select: {
      userId: true
    }
  });

  // Lawyers, team leads, admins: see ALL comments
  if (!isCollector || teamLead) {
    return { deletedAt: null };
  }

  // For collectors (non-team leads): get their LAST active assignment
  const assignments = await prisma.loanAssignment.findMany({
    where: {
      Loan: { publicId: loanPublicId, deletedAt: null },
      userId: user.id,
      Role: { name: 'collector' }, // Only collector role assignments
      isActive: true
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' }, // Latest first
    take: 1 // Get only the last one
  });

  // If no assignment found, return very restrictive filter
  if (!assignments.length) {
    return { id: -1 }; // No comments visible
  }

  // const assignmentDate = assignments[0].createdAt;

  // Build collector filter: combines BOTH requirements
  return {
    AND: [
      { deletedAt: null },

      // Only from assignment date onwards
      // { createdAt: { gte: assignmentDate } },

      // Only own + team leads + lawyers
      {
        OR: [
          { userId: user.id }, // Own comments
          { userId: getUserTeamLead?.userId }, // Team lead comments
          { User: { Role: { name: { in: ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'] } } } } // Lawyer comments
        ]
      },

      // Exclude other collectors' archived comments (preserve existing logic)
      {
        NOT: {
          AND: [
            { archived: true }, // Is archived
            { userId: { not: user.id } }, // Not their own
            { User: { Role: { name: 'collector' } } } // Is from a collector
          ]
        }
      }
    ]
  };
};

export const getCollectorLoansWithHighActDays = async (prisma: PrismaService, userId: number): Promise<number[]> => {
  const loans = await prisma.loan.findMany({
    where: {
      // actDays: { gt: 40 },
      lastActivite: { lte: subtractDays(new Date(), 40) },
      statusId: { notIn: LoanStatusGroups.CLOSED as any },
      LoanAssignment: {
        some: {
          isActive: true,
          User: { id: userId }
        }
      }
    },
    select: { id: true }
  });
  return loans.map(loan => loan.id);
}

export const getScheduledVisits = async (prisma: PrismaService, daysAgo: number): Promise<any[]> => {
  // Calculate the cutoff date (today minus daysAgo)
  const cutoffDate = dayjs()
    .subtract(daysAgo, 'day')
    .startOf('day')
    .toDate();

  // Find visits scheduled on or before the cutoff date (meaning they're overdue by daysAgo or more)
  const visitsToUpdate = await prisma.loanVisit.findMany({
    where: {
      scheduledAt: {
        lt: cutoffDate
      },
      status: 'pending',
      expiredAt: null,
      deletedAt: null
    },
    select: { id: true, scheduledAt: true, status: true }
  });

  return visitsToUpdate;
  // return visitsToUpdate.map(visit => visit.id);
}

export const updateVisitsToNA = async (prisma: PrismaService, visitIds: number[]): Promise<number> => {
  if (visitIds.length === 0) {
    return 0;
  }

  // Fetch all existing visits BEFORE transaction
  const existingVisits = await prisma.loanVisit.findMany({
    where: { id: { in: visitIds } },
  });

  // Execute all updates in a single transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update existing visits - batch operation
    await tx.loanVisit.updateMany({
      where: { id: { in: visitIds } },
      data: { expiredAt: new Date() },
    });

    // 2. Create new visits with status 'n_a' - batch operation
    const newVisits = existingVisits.map(visit => ({
      loanId: visit.loanId,
      status: 'n_a' as const,
      loanAddressId: visit.loanAddressId,
      comment: 'status changed to n/a by system',
      scheduledAt: new Date(),
      expiredAt: null,
      userId: visit.userId,
    }));

    await tx.loanVisit.createMany({
      data: newVisits,
    });
  });

  return existingVisits.length;
};

export const markSchedulesAsOverdue = async (prisma: PrismaService, date: Date) => {
  const overdueUpdate = await prisma.paymentSchedule.updateMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      paymentDate: { lt: date },
      deletedAt: null,
    },
    data: {
      status: 'OVERDUE'
    }
  });
  return overdueUpdate;
}

export const agreementsToCancel = async (prisma: PrismaService, sixtyDaysAgo: Date) => {
  const agreementsToCancel = await prisma.paymentCommitment.findMany({
    where: {
      type: 'agreement',
      isActive: 1,
      deletedAt: null,
      PaymentSchedule: {
        some: {
          status: 'OVERDUE',
          paymentDate: { lt: sixtyDaysAgo }
        }
      }
    },
    include: {
      PaymentSchedule: {
        where: {
          status: 'OVERDUE',
          paymentDate: { lt: sixtyDaysAgo }
        },
        orderBy: { paymentDate: 'asc' },
        take: 1
      },
      Loan: {
        include: { LoanStatus: true }
      }
    }
  });
  return agreementsToCancel;
}

export const cancelCommitment = async (prisma: Prisma.TransactionClient | PrismaClient, commitmentId: number) => {
  const commitment = await prisma.paymentCommitment.update({
    where: { id: commitmentId },
    data: { isActive: 0 }
  });

  return commitment;
}

export const cancelSchedules = async (prisma: Prisma.TransactionClient | PrismaClient, commitmentId: number) => {
  const schedules = await prisma.paymentSchedule.updateMany({
    where: { commitmentId },
    data: { status: 'CANCELLED' }
  });

  return schedules;
}

export const cancelLoan = async (prisma: Prisma.TransactionClient | PrismaClient, loanId: number, statusId: number) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { statusId: true, LoanStatus: true }
  });

  const isTransitionAllowed = await prisma.statusMatrixAutomatic.findFirst({
    where: {
      entityType: 'LOAN',
      fromStatusId: loan.statusId,
      toStatusId: statusId,
      isActive: true,
      deletedAt: null,
    },
  });

  if (!isTransitionAllowed) {
    throw new BadRequestException(`Status transition from ${loan.LoanStatus.name} status to 'Agreement cancel' is not allowed`);
  }
  const updatedLoan = await prisma.loan.update({
    where: { id: loanId },
    data: { statusId: statusId }
  });

  return updatedLoan;
}

export const prepareLoanExportData = (loan: any) => {
  const getAssignmentByRole = (roleName: string) =>
    loan.LoanAssignment?.find((a) => a.Role?.name === roleName);

  const collector = getAssignmentByRole('collector');
  const lawyer = getAssignmentByRole('lawyer');
  const juniorLawyer = getAssignmentByRole('junior-lawyer');
  const execLawyer = getAssignmentByRole('execution_lawyer');
  return {
    caseId: loan.caseId ?? '',
    portfolio: loan.PortfolioCaseGroup?.groupName ?? '',
    lender: loan.Portfolio.portfolioSeller?.name ?? '',
    fullName: `${loan.Debtor?.firstName ?? ''} ${loan.Debtor?.lastName ?? ''}`.trim(),
    idNumber: loan.Debtor.idNumber ?? '',
    city: loan?.LoanAddress[0]?.City?.city ?? '',
    address: loan?.LoanAddress[0]?.address ?? '',
    principal: loan.principal ?? '',
    totalDebt: loan.totalDebt ?? '',
    curr: loan.currency ?? '',
    interest: loan.interest ?? '',
    penalty: loan.penalty ?? '',
    otherFees: loan.otherFee ?? '',
    charges: loan.legalCharges ?? '',
    collateralStatus: loan?.LoanCollateralStatus[0]?.CollateralStatus?.title ?? '',
    clientStatus: loan.Debtor.DebtorStatus?.name ?? '',
    collectionStatus: loan.LoanStatus?.name ?? '',
    statusDate: loan.LoanStatus?.createdAt ?? '',
    visitStatus: loan?.LoanVisit[0]?.status ?? '',
    legalStage: loan?.LoanLegalStage[0]?.LegalStage?.title ?? '',
    litigationStage: loan?.LoanLitigationStage[0]?.LitigationStage?.title ?? '',
    mark: loan?.LoanMarks[0]?.Marks?.title ?? '',
    collector: collector
      ? `${collector.User?.firstName ?? ''} ${collector.User?.lastName ?? ''}`.trim()
      : '',
    collAssignDate: collector?.createdAt ?? '',
    lawyer: lawyer
      ? `${lawyer.User?.firstName ?? ''} ${lawyer.User?.lastName ?? ''}`.trim()
      : '',
    lawAssignDate: lawyer?.createdAt ?? '',
    juniorLawyer: juniorLawyer
      ? `${juniorLawyer.User?.firstName ?? ''} ${juniorLawyer.User?.lastName ?? ''}`.trim()
      : '',
    execLawyer: execLawyer
      ? `${execLawyer.User?.firstName ?? ''} ${execLawyer.User?.lastName ?? ''}`.trim()
      : '',
    actDay: loan.actDays ?? '',
  };
}

export const getLoanExportHeaders = (): Record<string, string> => {
  return {
    caseId: 'Case',
    portfolio: 'Portfolio',
    lender: 'Lender',
    fullName: 'Full Name',
    idNumber: 'ID Number',
    city: 'City',
    address: 'Address',
    principal: 'Principal',
    totalDebt: 'Total Debt',
    curr: 'Currency',
    interest: 'Interest',
    penalty: 'Penalty',
    otherFees: 'Other Fees',
    charges: 'Legal Charges',
    collateralStatus: 'Collateral Status',
    clientStatus: 'Client Status',
    collectionStatus: 'Collection Status',
    statusDate: 'Status Date',
    visitStatus: 'Visit Status',
    legalStage: 'Legal Stage',
    litigationStage: 'Litigation Stage',
    mark: 'Mark',
    collector: 'Collector',
    collAssignDate: 'Collector Assign Date',
    lawyer: 'Lawyer',
    lawAssignDate: 'Lawyer Assign Date',
    juniorLawyer: 'Junior Lawyer',
    execLawyer: 'Execution Lawyer',
    actDay: 'Act Day',
  };
}

export const createInitialLoanRemaining = async (prisma: Prisma.TransactionClient | PrismaClient, committee: any, agreementMinAmount: number) => {
  await prisma.loanRemaining.create({
    data: {
      loanId: committee.loanId,
      principal: committee.Loan.principal,
      interest: committee.Loan.interest,
      penalty: committee.Loan.penalty,
      otherFee: committee.Loan.otherFee,
      legalCharges: committee.Loan.legalCharges,
      currentDebt: committee.Loan.totalDebt,
      agreementMin: agreementMinAmount,
    }
  });
}

export const updateLoanRemaining = async (prisma: Prisma.TransactionClient | PrismaClient, currentRemaining: any, newAgreementMin: number) => {
  // Soft delete the current record
  await prisma.loanRemaining.update({
    where: { id: currentRemaining.id },
    data: { deletedAt: new Date() },
  });

  const currentDebt = Number(currentRemaining.currentDebt);
  const difference = currentDebt - newAgreementMin;

  const newLoanData = calculateNewLoanValues(currentRemaining, difference);

  await prisma.loanRemaining.create({
    data: {
      loanId: currentRemaining.loanId,
      ...newLoanData,
      currentDebt: newAgreementMin,
      agreementMin: newAgreementMin,
    },
  });
}

export const calculateNewLoanValues = (currentRemaining: any, difference: number) => {
  if (difference > 0) {
    // Current debt is higher than agreement min, need to reduce
    return handleDebtReduction(currentRemaining, difference);
  }

  if (difference < 0) {
    // Current debt is lower than agreement min, need to increase
    return handleDebtIncrease(currentRemaining, Math.abs(difference));
  }

  return copyCurrentValues(currentRemaining);
}

export const handleDebtReduction = (currentRemaining: any, reductionAmount: number) => {
  const values = {
    otherFee: Number(currentRemaining.otherFee),
    penalty: Number(currentRemaining.penalty),
    interest: Number(currentRemaining.interest),
    principal: Number(currentRemaining.principal),
    legalCharges: Number(currentRemaining.legalCharges),
  };

  const { newValues, remainingReduction } = applyReductions(values, reductionAmount);

  if (remainingReduction > 0) {
    throw new BadRequestException(
      'Cannot reduce debt: insufficient funds in Other Fee, Penalty, Interest, Principal, or Legal Charges to cover the reduction'
    );
  }

  return {
    otherFee: newValues.otherFee,
    penalty: newValues.penalty,
    interest: newValues.interest,
    principal: newValues.principal,
    legalCharges: newValues.legalCharges,
  };
}

export const applyReductions = (
  values: {
    otherFee: number;
    penalty: number;
    interest: number;
    principal: number;
    legalCharges: number;
  },
  amount: number
) => {
  const newValues = { ...values };
  let remainingReduction = amount;

  // 1. Reduce Other Fee first
  const otherFeeReduction = Math.min(newValues.otherFee, remainingReduction);
  newValues.otherFee -= otherFeeReduction;
  remainingReduction -= otherFeeReduction;

  // 2. Reduce Penalty
  const penaltyReduction = Math.min(newValues.penalty, remainingReduction);
  newValues.penalty -= penaltyReduction;
  remainingReduction -= penaltyReduction;

  // 3. Reduce Interest
  const interestReduction = Math.min(newValues.interest, remainingReduction);
  newValues.interest -= interestReduction;
  remainingReduction -= interestReduction;

  // 4. Reduce Principal
  const principalReduction = Math.min(newValues.principal, remainingReduction);
  newValues.principal -= principalReduction;
  remainingReduction -= principalReduction;

  // 5. Reduce Legal Charges
  const legalChargesReduction = Math.min(newValues.legalCharges, remainingReduction);
  newValues.legalCharges -= legalChargesReduction;
  remainingReduction -= legalChargesReduction;

  return { newValues, remainingReduction };
}

export const handleDebtIncrease = (currentRemaining: any, increaseAmount: number) => {
  return {
    principal: currentRemaining.principal,
    interest: currentRemaining.interest,
    penalty: Number(currentRemaining.penalty) + increaseAmount,
    otherFee: currentRemaining.otherFee,
    legalCharges: currentRemaining.legalCharges,
    currentDebt: Number(currentRemaining.currentDebt) + increaseAmount,
  };
}

export const copyCurrentValues = (currentRemaining: any) => {
  return {
    principal: currentRemaining.principal,
    interest: currentRemaining.interest,
    penalty: currentRemaining.penalty,
    otherFee: currentRemaining.otherFee,
    legalCharges: currentRemaining.legalCharges,
    currentDebt: currentRemaining.currentDebt,
  };
}

export const buildLoanSearchWhere = (searchValue: string) => {
  const trimmed = searchValue.trim();

  // Check if this is a global search (starts with #)
  const isGlobalSearch = trimmed.startsWith('#');
  const searchTerm = isGlobalSearch ? trimmed.substring(1).trim() : trimmed;

  const orConditions: Prisma.LoanWhereInput[] = [];

  // numeric Case ID
  orConditions.push({ caseId: String(searchTerm) });

  // Debtor personal ID
  orConditions.push({ Debtor: { idNumber: searchTerm } });

  // Debtor first/last name
  orConditions.push({ Debtor: { firstName: { contains: searchTerm } } });
  orConditions.push({ Debtor: { lastName: { contains: searchTerm } } });

  // Debtor phone
  orConditions.push({ Debtor: { mainPhone: { contains: searchTerm } } });

  orConditions.push({ Debtor: { DebtorContact: { some: { value: { contains: searchTerm } } } } });

  // Guarantors
  const guarantorFields = ['firstName', 'lastName', 'phone', 'mobile', 'idNumber'];
  guarantorFields.forEach((field) => {
    orConditions.push({
      Debtor: {
        DebtorGuarantors: {
          some: { [field]: { contains: searchTerm } },
        },
      },
    });
  });

  return { conditions: orConditions, isGlobalSearch };
};

export const getLatestLoanIds = async (
  prisma: PrismaService,
  table: string,
  relationField: string,
  filterValues: (number | string)[]
) => {
  // Determine the filter column name
  const filterColumn = relationField === 'status' ? 'status' : `${relationField}Id`;

  // Build the IN clause with proper escaping
  const filterList = filterValues
    .map(v => relationField === 'status' ? `'${String(v).replace(/'/g, "''")}'` : Number(v))
    .join(',');

  // Use window function to get latest record per loan - single efficient query
  // ROW_NUMBER() OVER (PARTITION BY loanId ORDER BY createdAt DESC) ranks records
  // Latest record for each loan gets rn = 1
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT loanId
    FROM (
      SELECT
        loanId,
        ${filterColumn},
        ROW_NUMBER() OVER (
          PARTITION BY loanId
          ORDER BY createdAt DESC
        ) as rn
      FROM ${table}
      WHERE deletedAt IS NULL
    ) ranked
    WHERE rn = 1
      AND ${filterColumn} IN (${filterList})
  `);

  return result.map((r) => r.loanId);
};

export const calculateWriteoff = async (
  loan: any,
  paymentsHelper: any
): Promise<any> => {
  const toNumber = (v: any) => Number(v) || 0;

  const totalPayments =
    await paymentsHelper.getTotalPaymentsByPublicId(loan.publicId);

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

  return {
    principal: initPrincipal - totalPaidPrincipal,
    interest: initInterest - totalPaidInterest,
    penalty: initPenalty - totalPaidPenalty,
    otherFee: initOtherFee - totalPaidOtherFee,
    legalCharges: initLegalCharges - totalPaidLegalCharges,
    totalWriteOff: initDebt - totalPaymentsAmount,
  };
};

export const saveScheduleReminders = async (
  data: { loanId: number, commitmentId: number; userId: number, type: Reminders_type },
  prisma: Prisma.TransactionClient | PrismaClient,
) => {
  const { loanId, commitmentId, userId, type } = data;

  const paymentCommitment = await prisma.paymentCommitment.findUnique({
    where: { id: commitmentId },
    select: { paymentDate: true, amount: true, PaymentSchedule: true },
  });

  const { paymentDate, amount, PaymentSchedule } = paymentCommitment;

  let remindersData: Array<{
    loanId: number;
    type: Reminders_type;
    comment: string;
    status: boolean;
    fromUserId: number;
    toUserId: number;
    deadline: Date;
  }> = [];

  if (type === Reminders_type.Agreement) {
    if (!PaymentSchedule || PaymentSchedule.length === 0) {
      throw new Error('PaymentSchedule is empty for Agreement type');
    }

    remindersData = PaymentSchedule.map(item => ({
      loanId,
      type,
      comment: `${type}: ${item.amount.toString()}`,
      status: true,
      fromUserId: userId,
      toUserId: userId,
      deadline: item.paymentDate,
    }));
  } else if (type === Reminders_type.Promised_to_pay) {
    remindersData = [{
      loanId,
      type,
      comment: `${type}: ${amount.toString()}`,
      status: true,
      fromUserId: userId,
      toUserId: userId,
      deadline: paymentDate,
    }];
  }

  if (remindersData.length > 0) {
    await prisma.reminders.createMany({
      data: remindersData,
    });
  }
}

export const shouldSkipUserScope = (user: any, filters: any): boolean => {
  const teamLead = isTeamLead(user);

  if (!teamLead) {
    return false;
  }

  // Collector team lead filtering by assigneduser (collectors)
  if (user.role_name === 'collector' && filters.assigneduser?.length > 0) {
    return true;
  }

  // Lawyer team lead filtering by any lawyer assignment
  const LAWYER_ROLES = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'];
  if (LAWYER_ROLES.includes(user.role_name)) {
    const hasLawyerFilter =
      filters.assignedlawyer?.length > 0 ||
      filters.assignedjuniorLawyer?.length > 0 ||
      filters.assignedexecutionLawyer?.length > 0;

    if (hasLawyerFilter) {
      return true;
    }
  }

  return false;
}

export const calculateLoanSummary = async (
  permissionsHelper: any,
  where: any,
  skipUserScope: boolean
) => {
  // Fetch all loans matching the filter (respecting permissions)
  const loans = await permissionsHelper.loan.findMany({
    where,
    _skipUserScope: skipUserScope,
    select: {
      currency: true,
      principal: true,
      totalDebt: true,
      LoanRemaining: {
        where: { deletedAt: null },
        select: {
          principal: true,
          interest: true,
          penalty: true,
          otherFee: true,
          legalCharges: true,
          currentDebt: true,
        },
      },
    },
  });

  // Initialize summary for all currencies
  const summary = {
    GEL: { title: 'GEL', cases: 0, principal: 0, debt: 0 },
    USD: { title: 'USD', cases: 0, principal: 0, debt: 0 },
    EUR: { title: 'EUR', cases: 0, principal: 0, debt: 0 },
  };

  // Aggregate by currency
  loans.forEach((loan) => {
    const currency = loan.currency?.toUpperCase() || 'GEL';

    if (summary[currency]) {
      summary[currency].cases += 1;

      // Use LoanRemaining if available (current debt), otherwise use original loan values
      if (loan.LoanRemaining && loan.LoanRemaining.length > 0) {
        const remaining = loan.LoanRemaining[0];
        summary[currency].principal += Number(remaining.principal || 0);
        summary[currency].debt += Number(remaining.currentDebt || 0);
      } else {
        // Fallback to original loan values if LoanRemaining doesn't exist
        summary[currency].principal += Number(loan.principal || 0);
        summary[currency].debt += Number(loan.totalDebt || 0);
      }
    }
  });

  // Round to 2 decimal places
  Object.keys(summary).forEach((currency) => {
    summary[currency].principal = Number(summary[currency].principal.toFixed(2));
    summary[currency].debt = Number(summary[currency].debt.toFixed(2));
  });

  return summary;
}
export const calculateLoanSummaryNew = async (
  permissionsHelper: any,
  where: any,
  skipUserScope: boolean
) => {
  // Calculate summaries for each currency in parallel
  const [gelData, usdData, eurData] = await Promise.all([
    calculateCurrencySummary(permissionsHelper, where, skipUserScope, 'GEL'),
    calculateCurrencySummary(permissionsHelper, where, skipUserScope, 'USD'),
    calculateCurrencySummary(permissionsHelper, where, skipUserScope, 'EUR'),
  ]);

  return {
    GEL: gelData,
    USD: usdData,
    EUR: eurData,
  };
};

// Helper function to calculate summary for a specific currency
async function calculateCurrencySummary(
  permissionsHelper: any,
  where: any,
  skipUserScope: boolean,
  currency: string
) {
  // Build where clause for this currency
  const currencyWhere = {
    ...where,
    currency: { equals: currency },
  };

  // Count cases for this currency
  const cases = await permissionsHelper.loan.count({
    where: currencyWhere,
    _skipUserScope: skipUserScope,
  });

  // If no cases, return zero summary immediately
  if (cases === 0) {
    return { title: currency, cases: 0, principal: 0, debt: 0 };
  }

  // Fetch only the fields we need (much faster than fetching all loan data)
  const loans = await permissionsHelper.loan.findMany({
    where: currencyWhere,
    _skipUserScope: skipUserScope,
    select: {
      principal: true,
      totalDebt: true,
      LoanRemaining: {
        where: { deletedAt: null },
        select: {
          principal: true,
          currentDebt: true,
        },
        take: 1, // Only get the first LoanRemaining record
      },
    },
  });

  // Calculate totals
  let totalPrincipal = 0;
  let totalDebt = 0;

  loans.forEach((loan) => {
    if (loan.LoanRemaining && loan.LoanRemaining.length > 0) {
      const remaining = loan.LoanRemaining[0];
      totalPrincipal += Number(remaining.principal || 0);
      totalDebt += Number(remaining.currentDebt || 0);
    } else {
      totalPrincipal += Number(loan.principal || 0);
      totalDebt += Number(loan.totalDebt || 0);
    }
  });

  return {
    title: currency,
    cases,
    principal: Number(totalPrincipal.toFixed(2)),
    debt: Number(totalDebt.toFixed(2)),
  };
}