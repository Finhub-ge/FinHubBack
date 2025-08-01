import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
  ) { }

  async getAll() {
    const loans = await this.prisma.loan.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        Portfolio: {
          select: {
            name: true,
          }
        },
        Debtor: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        LoanStatus: {
          select: {
            name: true,
          }
        }
      }
    });

    return loans;
  }

  async getOne(publicId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: {
        publicId: publicId,
        deletedAt: null
      },
      include: {
        Portfolio: {
          select: {
            id: true,
            name: true,
            bankName: true,
            purchasePrice: true,
            purchaseDate: true,
            notes: true
          }
        },
        Debtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthdate: true,
            mainEmail: true,
            mainPhone: true,
            mainAddress: true,
            DebtorStatus: {
              select: { name: true }
            },
            DebtorContact: {
              select: {
                value: true,
                isPrimary: true,
                notes: true,
                ContactType: { select: { name: true } },
                ContactLabel: { select: { name: true } },
              },
            }
          }
        },
        LoanStatus: {
          select: {
            name: true,
            description: true
          }
        },
        LoanAttribute: {
          select: {
            value: true,
            Attributes: {
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
        Debtor: {
          include: {
            DebtorStatus: {
              select: { id: true, name: true, description: true }
            },
            DebtorContact: {
              where: { deletedAt: null },
              include: {
                ContactType: { select: { id: true, name: true } },
                ContactLabel: { select: { id: true, name: true } },
                User: { select: { id: true, firstName: true, lastName: true } }
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

    return loan.Debtor;
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
        ContactType: { select: { id: true, name: true } },
        ContactLabel: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } }
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
        Attributes: { select: { id: true, name: true } },
      },
    });

    return loanAttribute;
  }
}
