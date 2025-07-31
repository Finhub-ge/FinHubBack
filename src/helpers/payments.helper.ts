import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PaymentsHelper {
  constructor(
    private prisma: PrismaService,
  ) { }


  async gettransactionChannels() {
    return await this.prisma.transactionChannels.findMany({
      include: {
        TransactionChannelAccounts: true
      }
    })
  }


}
