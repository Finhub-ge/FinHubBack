import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatePaymentCommitment } from "src/interface/createPaymentCommitment";
import { CreatePaymentSchedule } from "src/interface/createPaymentSchedule";
import { PrismaService } from "src/prisma/prisma.service";
import { PrismaClient, Prisma } from '@prisma/client';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { PaymentScheduleItemDto } from "src/loan/dto/updateLoanStatus.dto";


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

  async getTotalPaymentsByPublicId(publicId) {
    const totals = await this.prisma.transaction.aggregate({
      where: {
        Loan: {
          publicId: publicId
        },
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
}