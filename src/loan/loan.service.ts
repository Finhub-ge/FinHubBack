import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getAll() {
    const loans = await this.prisma.loan.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        portfolio: {
          select: {
            name: true,
          }
        },
        debtor: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        status: {
          select: {
            name: true,
          }
        }
      }
    });

    return loans;
  }

  async getOne(id: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { 
        id,
        deletedAt: null 
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true,
            bankName: true,
            purchasePrice: true,
            purchaseDate: true,
            notes: true
          }
        },
        debtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthdate: true,
            mainEmail: true,
            mainPhone: true,
            mainAddress: true,
            status: {
              select: { name: true }
            },
            contacts: {
              select: { 
                value: true, 
                isPrimary: true, 
                notes: true,
                type: { select: { name: true } },
                label: { select: { name: true } },
              },
            }
          }
        },
        status: {
          select: {
            name: true,
            description: true
          }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }

  async getLoanDebtor(loanId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId, deletedAt: null },
      select: {
        debtor: {
          include: {
            status: {
              select: { id: true, name: true, description: true }
            },
            contacts: {
              where: { deletedAt: null },
              include: {
                type: { select: { id: true, name: true } },
                label: { select: { id: true, name: true } },
                user: { select: { id: true, firstName: true, lastName: true } }
              },
              orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'desc' }
              ]
            }
          }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan.debtor;
  }

  async addDebtorContact(debtorId: number, createContactDto: CreateContactDto, userId: number) {
    // Check if debtor exists
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId, deletedAt: null }
    });

    if (!debtor) {
      throw new NotFoundException('Debtor not found');
    }

    // If this is marked as primary, update other contacts to not be primary
    if (createContactDto.isPrimary) {
      await this.prisma.debtorContact.updateMany({
        where: { 
          debtorId,
          deletedAt: null 
        },
        data: { isPrimary: false }
      });
    }

    // Create the new contact
    const contact = await this.prisma.debtorContact.create({
      data: {
        debtorId,
        typeId: createContactDto.typeId,
        value: createContactDto.value,
        labelId: createContactDto.labelId,
        isPrimary: createContactDto.isPrimary || false,
        notes: createContactDto.notes,
        userId: userId
      },
      include: {
        type: { select: { id: true, name: true } },
        label: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return contact;
  }
}
