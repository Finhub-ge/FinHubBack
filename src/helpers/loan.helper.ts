import { PrismaClient } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
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

export const handleCommentsForReassignment = async (loanId: number, roleId: number, userId: number, assignedBy: number, tx?: any) => {
  const dbClient = tx || prisma; // Use transaction if provided, otherwise use main prisma

  const currentAssignment = await getCurrentAssignment(loanId, roleId, dbClient);

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
  // Find all active comments from this user for this loan
  console.log(loanId, roleId);
  const commentsToArchive = await dbClient.comments.findMany({
    where: {
      loanId: loanId,
      deletedAt: null,
      User: {
        roleId: roleId  // Filter by role instead of specific userId
      }
    },
    include: {
      User: {
        select: {
          id: true,
          roleId: true,
        }
      }
    }
  });
  console.log(commentsToArchive);
  // If no comments to archive, return early
  if (commentsToArchive.length === 0) {
    return;
  }

  // Prepare archive data as array
  const archiveData = commentsToArchive.map(comment => ({
    originalCommentId: comment.id,
    loanId: comment.loanId,
    userId: comment.userId,
    comment: comment.comment,
    uploadId: comment.uploadId,
    originalCreatedAt: comment.createdAt,
    originalUpdatedAt: comment.updatedAt,
    archivedBy: archivedBy,
    archiveReason: 'role_reassignment'
  }));

  // Execute all archive operations
  // await dbClient.commentHistory.createMany({
  //   data: archiveData
  // });

  // // Soft delete the original comments
  // await dbClient.comments.updateMany({
  //   where: {
  //     loanId: loanId,
  //     userId: userId,
  //     deletedAt: null
  //   },
  //   data: {
  //     deletedAt: new Date()
  //   }
  // });
}