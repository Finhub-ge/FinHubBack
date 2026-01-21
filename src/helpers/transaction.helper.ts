import { PrismaService } from 'src/prisma/prisma.service';
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import { Prisma } from '@prisma/client';

/**
 * Search for a loan by search term (case ID, debtor name, ID number)
 * Returns loan if found and NOT closed
 */
export const findLoanBySearchTerm = async (
  prisma: PrismaService,
  searchTerm: string
): Promise<any | null> => {
  if (!searchTerm?.trim()) return null;

  const term = searchTerm.trim();

  // Build search conditions for non-closed loans
  const loan = await prisma.loan.findMany({
    where: {
      deletedAt: null,
      // Exclude closed loans
      statusId: {
        notIn: LoanStatusGroups.CLOSED as unknown as number[],
      },
      OR: [
        { caseId: term },
        {
          Debtor: {
            OR: [
              { firstName: { contains: term } },
              { lastName: { contains: term } },
              { idNumber: term },
            ],
          },
        },
      ],
    },
    include: {
      Debtor: true,
      LoanRemaining: {
        where: { deletedAt: null },
      },
      PaymentCommitment: {
        where: { deletedAt: null, isActive: 1 },
        orderBy: { createdAt: Prisma.SortOrder.asc },
        take: 1,
        include: {
          PaymentSchedule: {
            where: { deletedAt: null },
          },
        },
      },
      LoanStatus: true,
      Portfolio: true,
      PortfolioCaseGroup: {
        select: {
          groupName: true,
        },
      },
      LoanAssignment: {
        where: { isActive: true },
        select: {
          createdAt: true,
          User: { select: { id: true, firstName: true, lastName: true } },
          Role: { select: { name: true } },
        },
      },
    },
  });

  return loan;
};

/**
 * Create a transaction-like object with null values but populated loan
 * This maintains the same structure as real transactions
 */
export const createEmptyTransactionWithLoan = (loan: any): any => {
  return {
    // All transaction fields as null
    id: null,
    loanId: loan.id,
    amount: null,
    paymentDate: null,
    principal: null,
    interest: null,
    penalty: null,
    fees: null,
    legal: null,
    currency: loan.currency || 'GEL',
    deleted: 0,
    createdAt: null,
    userId: null,
    transactionChannelAccountId: null,
    comment: null,

    // Null relations for transaction
    TransactionChannelAccounts: null,
    User: null,

    // Populated loan data
    Loan: loan,
  };
};
