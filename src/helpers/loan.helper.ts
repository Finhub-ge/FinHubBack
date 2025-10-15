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