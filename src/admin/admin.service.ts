import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getDebtorContactTypes() {
    return this.prisma.contactType.findMany();
  }

  async getDebtorContactLabels() {
    return this.prisma.contactLabel.findMany();
  }

  async getAttributes() {
    return this.prisma.attributes.findMany()
  }
}