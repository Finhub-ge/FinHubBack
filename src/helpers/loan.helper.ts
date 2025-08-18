import { PrismaService } from "src/prisma/prisma.service";

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