import { Injectable, Logger } from '@nestjs/common';
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Common service for all online payment providers
 */
@Injectable()
export class OnlinePaymentCommonService {
  private readonly logger = new Logger(OnlinePaymentCommonService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find loan by case ID
   * Returns loan with debtor and debt amount
   */
  async findLoanByCaseId(caseId: string): Promise<{
    success: boolean;
    loan?: any;
    debtor?: any;
    debt?: number;
    error?: string;
  }> {
    try {
      const loan = await this.prisma.loan.findFirst({
        where: {
          caseId: caseId,
          deletedAt: null,
          statusId: { notIn: LoanStatusGroups.CLOSED as any }
        },
        include: {
          Debtor: {
            select: {
              idNumber: true,
              firstName: true,
              lastName: true,
            }
          },
          LoanRemaining: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!loan) {
        return {
          success: false,
          error: 'Loan not found or closed',
        };
      }

      const currentDebt = loan.LoanRemaining[0];
      if (!currentDebt) {
        return {
          success: false,
          error: 'Loan balance not found',
        };
      }

      // Use agreementMin if exists, otherwise use currentDebt
      const debt = currentDebt.agreementMin && Number(currentDebt.agreementMin) > 0
        ? Number(currentDebt.agreementMin)
        : Number(currentDebt.currentDebt);

      return {
        success: true,
        loan,
        debtor: loan.Debtor,
        debt,
      };

    } catch (error) {
      this.logger.error('Error finding loan:', error);
      return {
        success: false,
        error: 'Database error',
      };
    }
  }

}
