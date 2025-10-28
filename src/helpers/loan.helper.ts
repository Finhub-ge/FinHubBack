import { Prisma, PrismaClient, TeamMembership_teamRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import * as dayjs from "dayjs";
import { statusToId } from "src/enums/visitStatus.enum";
import { BadRequestException } from "@nestjs/common";
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

export const getCollectorLoansWithHighActDays = async (prisma: PrismaService, userId: number): Promise<number[]> => {
  const loans = await prisma.loan.findMany({
    where: {
      actDays: { gt: 40 },
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

export const calculateRemainingChanges = (remaining: any[]) => {
  if (remaining.length < 2) {
    return null;
  }

  // Filter out the last record if it's all zeros (payment)
  let activeHistory = [...remaining];
  const lastRecord = activeHistory[activeHistory.length - 1];

  const isLastRecordZero =
    parseFloat(lastRecord.principal?.toString() || '0') === 0 &&
    parseFloat(lastRecord.interest?.toString() || '0') === 0 &&
    parseFloat(lastRecord.penalty?.toString() || '0') === 0 &&
    parseFloat(lastRecord.otherFee?.toString() || '0') === 0 &&
    parseFloat(lastRecord.legalCharges?.toString() || '0') === 0;

  if (isLastRecordZero) {
    activeHistory = activeHistory.slice(0, -1); // Remove last record
  }

  if (activeHistory.length < 2) {
    return null; // No changes to calculate
  }

  const fields = ['principal', 'interest', 'penalty', 'otherFee', 'legalCharges'];

  const result = {
    principal: 0,
    interest: 0,
    penalty: 0,
    otherFee: 0,
    legalCharges: 0,
    totalWriteOff: 0
  };

  // Compare consecutive records (excluding the payment record)
  for (let i = 1; i < activeHistory.length; i++) {
    const previous = activeHistory[i - 1];
    const current = activeHistory[i];

    fields.forEach(field => {
      const oldValue = parseFloat(previous[field]?.toString() || '0');
      const newValue = parseFloat(current[field]?.toString() || '0');

      // Positive if decreased (write-off), negative if increased (added debt)
      const change = oldValue - newValue;

      result[field] += change;
    });
  }

  // Calculate totalWriteOff (sum of all components)
  result.totalWriteOff = result.principal + result.interest + result.penalty +
    result.otherFee + result.legalCharges;

  // Round to 2 decimal places
  result.principal = parseFloat(result.principal.toFixed(2));
  result.interest = parseFloat(result.interest.toFixed(2));
  result.penalty = parseFloat(result.penalty.toFixed(2));
  result.otherFee = parseFloat(result.otherFee.toFixed(2));
  result.legalCharges = parseFloat(result.legalCharges.toFixed(2));
  result.totalWriteOff = parseFloat(result.totalWriteOff.toFixed(2));

  return result;
}

export const buildLoanSearchWhere = (searchValue: string) => {
  const trimmed = searchValue.trim();
  const isNumeric = /^\d+$/.test(trimmed);
  const orConditions: Prisma.LoanWhereInput[] = [];

  // numeric Case ID
  if (isNumeric) orConditions.push({ caseId: Number(trimmed) });

  // Debtor personal ID
  orConditions.push({ Debtor: { idNumber: trimmed } });

  // Debtor first/last name
  orConditions.push({ Debtor: { firstName: { contains: trimmed } } });
  orConditions.push({ Debtor: { lastName: { contains: trimmed } } });

  // Debtor phone
  orConditions.push({ Debtor: { mainPhone: { contains: trimmed } } });

  // Guarantors
  const guarantorFields = ['firstName', 'lastName', 'phone', 'mobile', 'idNumber'];
  guarantorFields.forEach((field) => {
    orConditions.push({
      Debtor: {
        DebtorGuarantors: {
          some: { [field]: { contains: trimmed } },
        },
      },
    });
  });

  return orConditions;
};

export const getLatestLoanIds = async (prisma: PrismaService, table: string, relationField: string, filterValues: (number | string)[]) => {
  const latest = await prisma[table].groupBy({
    by: ['loanId'],
    where: { deletedAt: null },
    _max: { createdAt: true },
  });

  const whereCondition: any = {
    deletedAt: null,
    OR: latest.map((s) => ({
      loanId: s.loanId,
      createdAt: s._max.createdAt,
    })),
  };

  if (relationField === 'status') {
    whereCondition.status = { in: Array.isArray(filterValues) ? filterValues : [filterValues] };
  } else {
    whereCondition[`${relationField}Id`] = { in: filterValues.map(Number) };
  }

  const matches = await prisma[table].findMany({
    where: whereCondition,
    select: { loanId: true },
  });

  return matches.map((m) => m.loanId);
};