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