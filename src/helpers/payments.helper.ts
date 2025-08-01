import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatePaymentCommitment } from "src/interface/createPaymentCommitment";
import { CreatePaymentSchedule } from "src/interface/createPaymentSchedule";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PaymentsHelper {
  constructor(
    private prisma: PrismaService,
  ) { }


  // async gettransactionChannels() {
  //   return await this.prisma.transactionChannels.findMany({
  //     include: {
  //       TransactionChannelAccounts: true
  //     }
  //   })
  // }

  async createPaymentCommitment(data: CreatePaymentCommitment) {
    return await this.prisma.paymentCommitment.create({
      data: {
        loanId: data.loanId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        comment: data.comment || null,
        type: data.type, 
        userId: data.userId,
        isActive: 1, 
      }
    })
  }

  async createPaymentSchedule(data: CreatePaymentSchedule) {
    const { commitmentId, paymentDate, amount, numberOfMonths } = data;

    if (numberOfMonths <= 0) {
      throw new BadRequestException('Number of months must be greater than 0');
    }

    const monthlyAmount = Number((amount / numberOfMonths).toFixed(2));
    const schedules = [];

    let currentDate = new Date(paymentDate);

    for (let i = 0; i < numberOfMonths; i++) {
      const dueDate = new Date(currentDate);
      dueDate.setMonth(currentDate.getMonth() + i); // add i months to original date

      schedules.push({
        commitmentId,
        paymentDate: dueDate,
        amount: monthlyAmount,
      });
    }

    await this.prisma.paymentSchedule.createMany({
      data: schedules,
    });
  }
}         