import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';
import { AddCommentDto } from './dto/addComment.dto';
import { AddDebtorStatusDto } from './dto/addDebtorStatus.dto';
import { UpdateLoanStatusDto } from './dto/updateLoanStatus.dto';
import { PaymentsHelper } from 'src/helpers/payments.helper';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
    private readonly paymentsHelper: PaymentsHelper, 
  ) {}

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
            status: {
              select: { 
                name: true,
              }
            },
            debtorStatusHistories: {
              select: {
                newStatus: { select: { name: true } },
                oldStatus: { select: { name: true } },
                notes: true,
                createdAt: true,
                changedByUser: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              },
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
        loanStatusHistories: {
          select: {
            newStatus: { select: { name: true } },
            oldStatus: { select: { name: true } },
            notes: true,
            createdAt: true,
            changedByUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          },
        },
        loanAttributes: {
          select: {
            value: true,
            Attributes: {
              select: {
                name: true
              }
            }
          }
        },
        Comments: {
          select: {
            comment: true,
            createdAt: true,
            User: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const activeCommitments = await this.prisma.paymentCommitment.findMany({
      where: { loanId, isActive: 1 },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        type: true,
        comment: true,
        isActive: true,
        PaymentSchedule: {
          select: {
            id: true,
            paymentDate: true,
            amount: true,
          },
        },
      },
    });

    return {
      ...loan,
      activeCommitments,
    };
  }

  async addDebtorContact(loanId: number, createContactDto: CreateContactDto, userId: number) {
    // Get the debtorId from the loan
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
      where: { id: loan.debtorId, deletedAt: null }
    });

    if (!debtor) {
      throw new NotFoundException('Debtor not found');
    }

    // If this is marked as primary, update other contacts to not be primary
    if (createContactDto.isPrimary) {
      await this.prisma.debtorContact.updateMany({
        where: { 
          debtorId: debtor.id,
          deletedAt: null 
        },
        data: { isPrimary: false }
      });
    }

    // Create the new contact
    const contact = await this.prisma.debtorContact.create({
      data: {
        debtorId: debtor.id,
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

  async addComment(loanId: number, addCommentDto: AddCommentDto, userId: number) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId, deletedAt: null }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Create the comment
    const comment = await this.prisma.comments.create({
      data: {
        loanId,
        userId,
        comment: addCommentDto.comment,
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } }
      }
    })
    return comment;
  }

  async updateDeptorStatus(loanId: number, addDebtorStatusDto: AddDebtorStatusDto, userId: number) {
   // Get the debtorId from the loan
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId, deletedAt: null },
      select: { debtorId: true }
    });
    
    // Check if debtor exists
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: loan.debtorId, deletedAt: null }
    });

    if (!debtor) {
      throw new NotFoundException('Debtor not found');
    }

    // Update debtor status
    const [_, updatedDebtor] = await this.prisma.$transaction([
      // 1. Create history
      this.prisma.debtorStatusHistory.create({
        data: {
          debtorId: debtor.id,
          oldStatusId: debtor.statusId,
          newStatusId: addDebtorStatusDto.statusId,
          changedBy: userId,
          notes: addDebtorStatusDto.notes ?? null,
        },
      }),

      // 2. Update debtor status
      this.prisma.debtor.update({
        where: { id: debtor.id },
        data: { statusId: addDebtorStatusDto.statusId },
        include: {
          status: { select: { name: true } },
        },
      }),
    ]);

    return updatedDebtor;
  }

  async updateLoanStatus(loanId: number, updateLoanStatusDto: UpdateLoanStatusDto, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId, deletedAt: null },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      const status = await tx.loanStatus.findUnique({
        where: { id: updateLoanStatusDto.statusId },
      });

      if (!status) {
        throw new NotFoundException('Status not found');
      }

      await tx.loanStatusHistory.create({
        data: {
          loanId: loan.id,
          oldStatusId: loan.statusId,
          newStatusId: updateLoanStatusDto.statusId,
          changedBy: userId,
          notes: updateLoanStatusDto.comment ?? null,
        },
      });

      if (status.name === 'Agreement') {
        if (!updateLoanStatusDto.agreement) {
          throw new BadRequestException('Agreement data is required for agreement status');
        }

        await tx.paymentCommitment.updateMany({
          where: { loanId: loan.id, isActive: 1 },
          data: { isActive: 0 },
        });

        const commitment = await this.paymentsHelper.createPaymentCommitment(
          {
            loanId: loanId,
            amount: updateLoanStatusDto.agreement.agreedAmount,
            paymentDate: updateLoanStatusDto.agreement.firstPaymentDate,
            comment: updateLoanStatusDto?.comment || null,
            userId: userId,
            type: 'agreement',
          },
          tx // pass the transaction client
        );
        await this.paymentsHelper.createPaymentSchedule(
          {
            commitmentId: commitment.id,
            paymentDate: updateLoanStatusDto.agreement.firstPaymentDate,
            amount: updateLoanStatusDto.agreement.agreedAmount,
            numberOfMonths: updateLoanStatusDto.agreement.numberOfMonths,
          },
          tx // pass the transaction client
        );
      }

      if (status.name === 'Promised To Pay') {
        if (!updateLoanStatusDto.promise) {
          throw new BadRequestException('Promise data is required for promise status');
        }

        await tx.paymentCommitment.updateMany({
          where: { loanId: loan.id, isActive: 1 },
          data: { isActive: 0 },
        });

        await this.paymentsHelper.createPaymentCommitment(
          {
            loanId: loanId,
            amount: updateLoanStatusDto.promise.agreedAmount,
            paymentDate: updateLoanStatusDto.promise.paymentDate,
            comment: updateLoanStatusDto?.comment || null,
            userId: userId,
            type: 'promise',
          },tx // pass the transaction client
        ) 
      }

      return await tx.loan.update({
        where: { id: loanId },
        data: { statusId: updateLoanStatusDto.statusId },
        include: {
          status: { select: { name: true } },
        },
      });
    });
  }
}
