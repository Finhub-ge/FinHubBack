import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatePaymentCommitment } from "src/interface/createPaymentCommitment";
import { CreatePaymentSchedule } from "src/interface/createPaymentSchedule";
import { PrismaService } from "src/prisma/prisma.service";
import { PrismaClient, Prisma } from '@prisma/client';
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";


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

  async gettransactionChannels() {
    return await this.prisma.transactionChannels.findMany({
      include: {
        TransactionChannelAccounts: true
      }
    })
  }
}