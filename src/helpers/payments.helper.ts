import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatePaymentCommitment } from "src/interface/createPaymentCommitment";
import { CreatePaymentSchedule } from "src/interface/createPaymentSchedule";
import { PrismaService } from "src/prisma/prisma.service";
import { PrismaClient, Prisma, LoanRemaining, Charges_status } from '@prisma/client';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { PaymentScheduleItemDto } from "src/loan/dto/updateLoanStatus.dto";
import { getEndOfDay, getMonth, getStartOfDay, getYear } from "./date.helper";


dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class PaymentsHelper {
  constructor(
    private prisma: PrismaService,
  ) { }

  async createPaymentCommitment(data: CreatePaymentCommitment, prisma: Prisma.TransactionClient | PrismaClient = this.prisma) {
    return await prisma.paymentCommitment.create({
      data: {
        loanId: data.loanId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        comment: data.comment || null,
        type: data.type,
        userId: data.userId,
        isActive: 1,
      },
    });
  }

  async createPaymentSchedule(data: CreatePaymentSchedule, prisma: Prisma.TransactionClient | PrismaClient = this.prisma) {
    const { commitmentId, paymentDate, amount, numberOfMonths } = data;

    if (numberOfMonths <= 0) {
      throw new BadRequestException('Number of months must be greater than 0');
    }

    const monthlyAmount = Number((amount / numberOfMonths).toFixed(2));
    const schedules = [];

    let currentDate = dayjs.utc(paymentDate);;

    for (let i = 0; i < numberOfMonths; i++) {
      const dueDate = currentDate.add(i, 'month').toDate();
      // dueDate.setMonth(currentDate.getMonth() + i); // add i months to original date

      schedules.push({
        commitmentId,
        paymentDate: dueDate,
        amount: monthlyAmount,
      });
    }

    await prisma.paymentSchedule.createMany({
      data: schedules,
    });
  }

  async savePaymentSchedule(
    data: { commitmentId: number; schedules: PaymentScheduleItemDto[] },
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    const { commitmentId, schedules } = data;

    const scheduleData = schedules.map(item => ({
      commitmentId,
      paymentDate: new Date(item.paymentDate),
      amount: Number(item.amount),
    }));

    await prisma.paymentSchedule.createMany({
      data: scheduleData,
    });
  }

  async gettransactionChannels() {
    return await this.prisma.transactionChannels.findMany({
      include: {
        TransactionChannelAccounts: true
      }
    })
  }

  async getTotalPaymentsByPublicId(loanId: number) {
    const totals = await this.prisma.transaction.aggregate({
      where: { loanId: loanId, deleted: 0 },
      _sum: {
        amount: true,
        principal: true,
        interest: true,
        penalty: true,
        fees: true,
        legal: true,
      }
    });

    const paymentTotals = {
      totalPayments: totals._sum.amount || 0,
      paidPrincipal: totals._sum.principal || 0,
      paidInterest: totals._sum.interest || 0,
      paidPenalty: totals._sum.penalty || 0,
      paidOtherFee: totals._sum.fees || 0,
      paidLegalCharges: totals._sum.legal || 0,
    };

    return paymentTotals;
  }

  async getBatchedTotalPaymentsByLoanIds(loanIds: number[]): Promise<Map<number, any>> {
    if (loanIds.length === 0) return new Map();

    // Single query with GROUP BY instead of N aggregate queries
    const results = await this.prisma.transaction.groupBy({
      by: ['loanId'],
      where: {
        loanId: { in: loanIds }
      },
      _sum: {
        amount: true,
        principal: true,
        interest: true,
        penalty: true,
        fees: true,
        legal: true,
      }
    });

    // Convert to Map for O(1) lookup
    const paymentsMap = new Map();
    results.forEach(result => {
      paymentsMap.set(result.loanId, {
        totalPayments: result._sum.amount || 0,
        paidPrincipal: result._sum.principal || 0,
        paidInterest: result._sum.interest || 0,
        paidPenalty: result._sum.penalty || 0,
        paidOtherFee: result._sum.fees || 0,
        paidLegalCharges: result._sum.legal || 0,
      });
    });

    return paymentsMap;
  }

  async getTransactionByLoanId(loanId: number, prisma: Prisma.TransactionClient | PrismaClient = this.prisma) {
    return await prisma.transaction.findMany({
      where: { loanId },
    });
  }

  async validateAndAdjustPaymentSchedule(
    schedule: PaymentScheduleItemDto[],
    agreedAmount: number,
    numberOfMonths: number,
    currentDebt: number
  ): Promise<PaymentScheduleItemDto[]> {
    // Check if number of schedule items matches numberOfMonths
    if (schedule.length !== numberOfMonths) {
      throw new BadRequestException(
        `Schedule must contain exactly ${numberOfMonths} payment(s). Received ${schedule.length}`
      );
    }

    // Convert all to numbers with 2 decimal places
    const agreedAmountFixed = Number(agreedAmount.toFixed(2));
    const currentDebtFixed = Number(currentDebt.toFixed(2));

    // Check if agreed amount doesn't exceed current debt
    if (agreedAmountFixed > currentDebtFixed) {
      throw new BadRequestException(
        `Agreed amount (${agreedAmountFixed}) cannot be greater than current debt (${currentDebtFixed})`
      );
    }

    // Validate that amounts are positive
    const hasNegativeAmount = schedule.some(item => Number(item.amount) <= 0);
    if (hasNegativeAmount) {
      throw new BadRequestException('Schedule cannot contain negative or zero amounts');
    }

    // Validate dates are in chronological order
    for (let i = 1; i < schedule.length; i++) {
      const prevDate = new Date(schedule[i - 1].paymentDate);
      const currDate = new Date(schedule[i].paymentDate);
      if (currDate <= prevDate) {
        throw new BadRequestException('Schedule dates must be in chronological order');
      }
    }

    // Calculate total amount from schedule with proper rounding
    const totalScheduleAmount = schedule.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const totalScheduleAmountFixed = Number(totalScheduleAmount.toFixed(2));

    // Check if total exceeds agreed amount
    if (totalScheduleAmountFixed > agreedAmountFixed) {
      throw new BadRequestException(
        `Sum of schedule amounts (${totalScheduleAmountFixed}) cannot exceed agreed amount (${agreedAmountFixed})`
      );
    }

    // Create adjusted schedule (deep copy with number conversion)
    const adjustedSchedule = schedule.map(item => ({
      ...item,
      amount: Number(Number(item.amount).toFixed(2))
    }));

    // Calculate difference with proper rounding
    const difference = Number((agreedAmountFixed - totalScheduleAmountFixed).toFixed(2));

    if (difference !== 0) {
      const lastIndex = adjustedSchedule.length - 1;
      const newLastAmount = Number(
        (adjustedSchedule[lastIndex].amount + difference).toFixed(2)
      );
      adjustedSchedule[lastIndex].amount = newLastAmount;
    }

    // Final validation: ensure last payment is not negative after adjustment
    const lastPayment = adjustedSchedule[adjustedSchedule.length - 1];
    if (lastPayment.amount < 0) {
      throw new BadRequestException(
        'Adjustment would result in negative last payment. Please review payment amounts.'
      );
    }

    return adjustedSchedule;
  }

  async allocatePayment(
    sourceId: number,
    sourceType: 'PAYMENT' | 'PENALTY_ADDED' | 'INTEREST_ACCRUED' | 'ADJUSTMENT' | 'FEE_ADDED' | 'LEGAL_CHARGES_ADDED',
    amount: number,
    loanRemaining: LoanRemaining,
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    const paymentAmount = Number(amount || 0);
    let remainingPayment = paymentAmount;

    // Define allocation priority order
    const allocationPriority = [
      { component: 'legalCharges', field: 'legal', type: 'LEGAL_CHARGES', order: 1 },
      { component: 'otherFee', field: 'fees', type: 'OTHER_FEE', order: 2 },
      { component: 'penalty', field: 'penalty', type: 'PENALTY', order: 3 },
      { component: 'interest', field: 'interest', type: 'INTEREST', order: 4 },
      { component: 'principal', field: 'principal', type: 'PRINCIPAL', order: 5 }
    ] as const;

    const allocationDetails = [];
    const newBalances = {
      legalCharges: Number(loanRemaining.legalCharges || 0),
      otherFee: Number(loanRemaining.otherFee || 0),
      penalty: Number(loanRemaining.penalty || 0),
      interest: Number(loanRemaining.interest || 0),
      principal: Number(loanRemaining.principal || 0)
    };

    const transactionSummary = {
      legal: 0,
      fees: 0,
      penalty: 0,
      interest: 0,
      principal: 0
    };

    // Process each component in waterfall order
    for (const allocation of allocationPriority) {
      const currentBalance = newBalances[allocation.component];

      if (currentBalance > 0 && remainingPayment > 0) {
        // Calculate how much to allocate to this component
        const amountToAllocate = Math.min(remainingPayment, currentBalance);
        const balanceBefore = currentBalance;
        const balanceAfter = currentBalance - amountToAllocate;

        // Store allocation detail (only if amount > 0)
        if (amountToAllocate > 0) {
          allocationDetails.push({
            loanId: loanRemaining.loanId,
            sourceId: sourceId,
            sourceType: sourceType,
            componentType: allocation.type,
            amountAllocated: amountToAllocate,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            allocationOrder: allocation.order
          });

          // Update balances
          newBalances[allocation.component] = balanceAfter;
          transactionSummary[allocation.field] = amountToAllocate;
          remainingPayment -= amountToAllocate;
        }
      }
    }

    // Calculate new total debt
    const newCurrentDebt =
      newBalances.legalCharges +
      newBalances.otherFee +
      newBalances.penalty +
      newBalances.interest +
      newBalances.principal;

    // Create PaymentAllocationDetail records (only for amounts > 0)
    if (allocationDetails.length > 0) {
      await prisma.paymentAllocationDetail.createMany({
        data: allocationDetails
      });
    }

    // Return all calculated data
    return {
      allocationDetails,
      newBalances,
      transactionSummary,
      newCurrentDebt,
      remainingPayment // In case of overpayment
    };
  }

  async updateTransactionSummary(
    transactionId: number,
    transactionSummary: {
      legal: number;
      fees: number;
      penalty: number;
      interest: number;
      principal: number;
    },
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        legal: transactionSummary.legal,
        fees: transactionSummary.fees,
        penalty: transactionSummary.penalty,
        interest: transactionSummary.interest,
        principal: transactionSummary.principal
      }
    });
  }

  async updateLoanRemaining(
    loanRemainingId: number,
    newBalances: {
      legalCharges: number;
      otherFee: number;
      penalty: number;
      interest: number;
      principal: number;
    },
    newCurrentDebt: number,
    loanRemaining: LoanRemaining,
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    const newAgreementMin = newCurrentDebt = Number(loanRemaining.agreementMin) ? newCurrentDebt : Number(loanRemaining.agreementMin);
    await prisma.loanRemaining.update({
      where: { id: loanRemainingId, },
      data: {
        deletedAt: new Date()
      }
    });
    await prisma.loanRemaining.create({
      data: {
        loanId: loanRemaining.loanId,
        ...newBalances,
        currentDebt: newCurrentDebt,
        agreementMin: newAgreementMin
      }
    });
  }

  async createBalanceHistory(
    loanId: number,
    sourceId: number,
    balances: {
      principal: number;
      interest: number;
      penalty: number;
      otherFee: number;
      legalCharges: number;
    },
    totalDebt: number,
    sourceType: 'PAYMENT' | 'PENALTY_ADDED' | 'INTEREST_ACCRUED' | 'ADJUSTMENT' | 'FEE_ADDED' | 'LEGAL_CHARGES_ADDED',
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    await prisma.loanBalanceHistory.create({
      data: {
        loanId: loanId,
        principal: balances.principal,
        interest: balances.interest,
        penalty: balances.penalty,
        otherFee: balances.otherFee,
        legalCharges: balances.legalCharges,
        totalDebt: totalDebt,
        sourceType: sourceType,
        sourceId: sourceId
      }
    });
  }

  async applyPaymentToSchedule(
    loanId: number,
    paymentAmount: number,
    paidDate: string,
    prisma: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    // Get active AGREEMENT commitments for this loan (only agreements have schedules)
    const activeCommitments = await prisma.paymentCommitment.findMany({
      where: {
        loanId: loanId,
        type: 'agreement',
        isActive: 1,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    const commitmentIds = activeCommitments.map(c => c.id);

    if (commitmentIds.length === 0) {
      return {
        scheduleUpdates: [],
        remainingAmount: paymentAmount,
        schedulesAffected: 0
      };
    }

    // Find unpaid/partial/overdue schedules for these commitments
    const unpaidSchedules = await prisma.paymentSchedule.findMany({
      where: {
        commitmentId: {
          in: commitmentIds
        },
        status: {
          in: ['PENDING', 'PARTIAL', 'OVERDUE']
        },
        deletedAt: null
      },
      orderBy: {
        paymentDate: 'asc'
      }
    });

    // Apply payment to schedules
    let paymentToApply = paymentAmount;

    for (const schedule of unpaidSchedules) {
      if (paymentToApply <= 0) break;

      // Calculate how much is still owed on this schedule
      const alreadyPaid = Number(schedule.paidAmount || 0);
      const totalScheduled = Number(schedule.amount);
      const remainingDue = totalScheduled - alreadyPaid;

      // Can't apply more than what's remaining on this schedule
      const amountForSchedule = Math.min(paymentToApply, remainingDue);

      // Calculate new paid amount and determine status
      const newPaidAmount = alreadyPaid + amountForSchedule;
      const newStatus = newPaidAmount >= totalScheduled ? 'PAID' : 'PARTIAL';

      // Update schedule
      await prisma.paymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidAmount: newPaidAmount,
          paidDate: newStatus === 'PAID' ? paidDate : schedule.paidDate,
          status: newStatus
        }
      });

      paymentToApply -= amountForSchedule;
    }
  }

  async applyPaymentToCharges(data: any) {
    const { loanId, allocationResult } = data;
    const { transactionSummary } = allocationResult;

    // Allocation amounts for each category
    let remainingOtherFee = Number(transactionSummary.fees || 0);
    let remainingLegalCharges = Number(transactionSummary.legal || 0);

    // Skip if nothing allocated
    if (remainingOtherFee <= 0 && remainingLegalCharges <= 0) return;

    // Define charge type mapping
    const legalTypeIds = [1, 2]; // Court, Execution
    const otherTypeIds = [3, 4, 5]; // Post, Registry, Other

    try {
      const unpaidCharges = await this.prisma.charges.findMany({
        where: {
          loanId: data.loanId,
          deletedAt: null,
          paymentDate: null
        },
        orderBy: { createdAt: 'asc' },
      });
      for (const charge of unpaidCharges) {
        const chargeAmount = Number(charge.amount) - Number(charge.paidAmount || 0);

        if (legalTypeIds.includes(charge.chargeTypeId) && remainingLegalCharges > 0) {
          const coverAmount = Math.min(remainingLegalCharges, chargeAmount);
          remainingLegalCharges -= coverAmount;
          await this.updateChargeStatus(charge.id, coverAmount);
        }

        if (otherTypeIds.includes(charge.chargeTypeId) && remainingOtherFee > 0) {
          const coverAmount = Math.min(remainingOtherFee, chargeAmount);
          remainingOtherFee -= coverAmount;
          await this.updateChargeStatus(charge.id, coverAmount);
        }

        if (remainingLegalCharges <= 0 && remainingOtherFee <= 0) break;
      }

    } catch (error) {
      console.error('applyPaymentToCharges failed:', error);
    }
  }

  private async updateChargeStatus(chargeId: number, covered: number) {
    const chargeRecord = await this.prisma.charges.findUnique({ where: { id: chargeId } });
    if (!chargeRecord) return;

    const previousPaid = Number(chargeRecord.paidAmount || 0);
    const newPaidAmount = previousPaid + covered;
    const isFullyPaid = newPaidAmount >= Number(chargeRecord.amount);

    await this.prisma.charges.update({
      where: { id: chargeId },
      data: {
        status: isFullyPaid ? Charges_status.PAID : Charges_status.PARTIALLY_PAID,
        paidAmount: newPaidAmount,
        paymentDate: isFullyPaid ? new Date() : chargeRecord.paymentDate,
      },
    });
  }

  async saveTransactionAssignments(transactionId: number) {
    // Fetch the transaction
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return;

    // Fetch the loan
    const loan = await this.prisma.loan.findUnique({ where: { id: transaction.loanId } });
    if (!loan) return;

    // Calculate the full day range for the payment date
    const startOfDay = getStartOfDay(transaction.paymentDate);
    const endOfDay = getEndOfDay(transaction.paymentDate);

    // Fetch active assignments for this loan at the transaction date
    const loanAssignment = await this.prisma.loanAssignment.findMany({
      where: {
        loanId: loan.id,
        assignedAt: { lte: endOfDay },
        OR: [
          { unassignedAt: null },
          { unassignedAt: { gte: startOfDay } },
        ],
      },
      select: {
        userId: true,
        roleId: true,
      },
    });
    if (loanAssignment.length === 0) return;

    // Prepare insert data
    const insertData = loanAssignment.map((assignment) => ({
      transactionId: transaction.id,
      userId: assignment.userId,
      roleId: assignment.roleId,
      amount: Number(transaction.amount || 0),
      year: Number(getYear(transaction.paymentDate)),
      month: Number(getMonth(transaction.paymentDate)),
    }));

    await this.prisma.transactionUserAssignments.createMany({
      data: insertData,
    });
  }
}