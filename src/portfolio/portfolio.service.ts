import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getAll() {
    return this.prisma.portfolio.findMany();
  }
}
