import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';

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
        },
        loanAttributes: {
          select: {
            value: true,
            attribute: {
              select: {
                name: true
              }
            }
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

  async addLoanAttributes(loanId: number, addLoanAttributesDto: AddLoanAttributesDto, userId: number) {
    // 1. Check if loan exists
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // 2. Check if attribute exists
    const attribute = await this.prisma.attributes.findFirst({
      where: { id: addLoanAttributesDto.attributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    // 3. Optional: check if this attribute already exists for this loan
    const existing = await this.prisma.loanAttribute.findFirst({
      where: {
        loanId,
        attributeId: addLoanAttributesDto.attributeId,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('This attribute is already added to the loan');
    }

    // 4. Create the loanAttribute
    const loanAttribute = await this.prisma.loanAttribute.create({
      data: {
        loanId,
        attributeId: addLoanAttributesDto.attributeId,
        value: addLoanAttributesDto.value,
      },
      include: {
        attribute: { select: { id: true, name: true } },
      },
    });

    return loanAttribute;
  }
}
