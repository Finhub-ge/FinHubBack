import { HttpException, Injectable, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper
  ) { }

  async getDebtorContactTypes() {
    return this.prisma.contactType.findMany();
  }

  async getDebtorContactLabels() {
    return this.prisma.contactLabel.findMany();
  }

  async getAttributes() {
    return this.prisma.attributes.findMany()
  }
  async getTransactionList() {
    const data = await this.prisma.transaction.findMany({
      where: {
        deleted: 0
      },
      include: {
        TransactionChannelAccounts: {
          include: {
            TransactionChannels: true
          }
        },
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        Loan: {
          include: {
            Debtor: true
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    const paymentChannels = await this.paymentHelper.gettransactionChannels()
    const dataObj = {}
    dataObj['transactions'] = data
    dataObj['paymentChannels'] = paymentChannels
    return dataObj;

  }

  async addPayment(publicId: ParseUUIDPipe, data: UpdatePaymentDto) {

    const loan = await this.prisma.loan.findUnique({
      where: {
        publicId: String(publicId)
      }
    })

    if (!loan) throw new HttpException('Loan not found', 404)

    await this.prisma.transaction.create({
      data: {
        loanId: loan.id,
        amount: Number(data.amount || 0),
        paymentDate: data.paymentDate,
        transactionChannelAccountId: data.accountId
      }
    })

    throw new HttpException('Payment added successfully', 200);
  }
  async updatePayment(publicId: ParseUUIDPipe, data: CreatePaymentDto) {

    const payment = await this.prisma.transaction.findUnique({
      where: {
        publicId: String(publicId)
      }
    })

    if (!payment) throw new HttpException('Payment not found', 404)

    await this.prisma.transaction.update({
      where: {
        publicId: String(publicId)
      },
      data: {
        amount: Number(data.amount || 0),
        paymentDate: data.paymentDate,
        transactionChannelAccountId: data.accountId
      }
    })

    throw new HttpException('Payment edited successfully', 200);
  }

  async deleteTransaction(id: number) {
    await this.prisma.transaction.delete({
      where: {
        id: id
      }
    })

    throw new HttpException('User deleted successfully', 200);

  }
}