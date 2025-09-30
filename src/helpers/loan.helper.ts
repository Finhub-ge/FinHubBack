import { PrismaClient, TeamMembership_teamRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import * as dayjs from "dayjs";
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

export const getScheduledVisits = async (prisma: PrismaService, daysAgo: number): Promise<number[]> => {
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
      deletedAt: null
    },
    select: { id: true, scheduledAt: true }
  });

  return visitsToUpdate.map(visit => visit.id);
}

export const updateVisitsToNA = async (prisma: PrismaService, visitIds: number[]): Promise<number> => {
  if (visitIds.length === 0) {
    return 0;
  }

  // Update all found visits to n_a status
  const result = await prisma.loanVisit.updateMany({
    where: {
      id: {
        in: visitIds
      }
    },
    data: {
      status: 'n_a',
      expiredAt: new Date()
    }
  });

  return result.count;
}