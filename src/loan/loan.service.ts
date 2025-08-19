import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';
import { AddCommentDto } from './dto/addComment.dto';
import { AddDebtorStatusDto } from './dto/addDebtorStatus.dto';
import { UpdateLoanStatusDto } from './dto/updateLoanStatus.dto';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import { SendSmsDto } from './dto/sendSms.dto';
import { UtilsHelper } from 'src/helpers/utils.helper';
import { SmsHistory_status } from '@prisma/client';
import { AssignLoanDto } from './dto/assignLoan.dto';
import { logAssignmentHistory } from 'src/helpers/loan.helper';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
    private readonly paymentsHelper: PaymentsHelper,
    private readonly utilsHelper: UtilsHelper
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
            idNumber: true,
            DebtorStatus: {
              select: {
                name: true,
              }
            }
          }
        },
        LoanStatus: {
          select: {
            name: true,
          }
        },
        LoanAssignment: {
          where: { isActive: true },
          select: {
            User: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            Role: {
              select: {
                name: true,
              }
            }
          },
        }
      }
    });

    return loans;
  }

  async getOne(publicId: ParseUUIDPipe) {
    const loan = await this.prisma.loan.findUnique({
      where: {
        publicId: String(publicId),
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
              select: {
                name: true,
              }
            },
            DebtorStatusHistory: {
              select: {
                newStatus: { select: { name: true } },
                oldStatus: { select: { name: true } },
                notes: true,
                createdAt: true,
                User: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              },
            },
            DebtorContact: {
              select: {
                id: true,
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
        LoanStatusHistory: {
          select: {
            LoanStatusNewStatus: { select: { name: true } },
            LoanStatusOldStatus: { select: { name: true } },
            notes: true,
            createdAt: true,
            User: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          },
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
        },
        Tasks: true,
        SmsHistory: {
          select: {
            id: true,
            message: true,
            status: true,
            createdAt: true,
            DebtorContact: {
              select: {
                value: true,
              }
            }
          }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const activeCommitments = await this.prisma.paymentCommitment.findMany({
      where: { loanId: loan.id, isActive: 1 },
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

  async addDebtorContact(publicId: ParseUUIDPipe, createContactDto: CreateContactDto, userId: number) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

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
    await this.prisma.debtorContact.create({
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

    throw new HttpException('Debtor contact added successfully', 200);
  }

  async addLoanAttributes(publicId: ParseUUIDPipe, addLoanAttributesDto: AddLoanAttributesDto, userId: number) {
    // 1. Check if loan exists
    const loan = await this.prisma.loan.findFirst({
      where: { publicId: String(publicId), deletedAt: null },
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
        loanId: loan.id,
        attributeId: addLoanAttributesDto.attributeId,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('This attribute is already added to the loan');
    }

    // 4. Create the loanAttribute
    await this.prisma.loanAttribute.create({
      data: {
        loanId: loan.id,
        attributeId: addLoanAttributesDto.attributeId,
        value: addLoanAttributesDto.value,
      },
      include: {
        Attributes: { select: { id: true, name: true } },
      },
    });

    throw new HttpException('Loan attribute added successfully', 200);
  }

  async addComment(publicId: ParseUUIDPipe, addCommentDto: AddCommentDto, userId: number) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Create the comment
    await this.prisma.comments.create({
      data: {
        loanId: loan.id,
        userId,
        comment: addCommentDto.comment,
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } }
      }
    })
    throw new HttpException('Comment added successfully', 200);
  }

  async updateDeptorStatus(publicId: ParseUUIDPipe, addDebtorStatusDto: AddDebtorStatusDto, userId: number) {
    // Get the debtorId from the loan
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
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
    await this.prisma.$transaction([
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
          DebtorStatus: { select: { name: true } },
        },
      }),
    ]);

    throw new HttpException('Debtor status updated successfully', 200);
  }

  async updateLoanStatus(publicId: ParseUUIDPipe, updateLoanStatusDto: UpdateLoanStatusDto, userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { publicId: String(publicId), deletedAt: null },
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
            loanId: loan.id,
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
            loanId: loan.id,
            amount: updateLoanStatusDto.promise.agreedAmount,
            paymentDate: updateLoanStatusDto.promise.paymentDate,
            comment: updateLoanStatusDto?.comment || null,
            userId: userId,
            type: 'promise',
          }, tx // pass the transaction client
        )
      }

      await tx.loan.update({
        where: { publicId: String(publicId) },
        data: { statusId: updateLoanStatusDto.statusId },
        include: {
          LoanStatus: { select: { name: true } },
        },
      });
    });
    throw new HttpException('Loan status updated successfully', 200);
  }


  async sendSms(publicId: ParseUUIDPipe, sendSmsDto: SendSmsDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    const contact = await this.prisma.debtorContact.findFirst({
      where: { id: sendSmsDto.contactId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const smsResult = await this.utilsHelper.sendSms(contact.value, sendSmsDto.message);

    await this.prisma.smsHistory.create({
      data: {
        loanId: loan.id,
        contactId: contact.id,
        phone: contact.value,
        message: sendSmsDto.message,
        status: smsResult.success ? SmsHistory_status.success : SmsHistory_status.failed,
        smsJson: JSON.stringify(smsResult),
        messageId: smsResult.messageId,
        errorCode: smsResult.errorCode,
        balance: smsResult.balance,
      },
    });

    return {
      success: smsResult.success,
      message: smsResult.success
        ? 'SMS sent successfully'
        : `SMS sending failed: ${smsResult.message || 'Unknown error'}`
    };
  }

  async assignLoanToUser(publicId: ParseUUIDPipe, assignLoanDto: AssignLoanDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // If no userId provided → unassign
    if (!assignLoanDto.userId) {
      return this.unassign({ loanId: loan.id, roleId: assignLoanDto.roleId, assignedBy: userId, });
    }

    const user = await this.prisma.user.findUnique({ where: { id: assignLoanDto.userId } });
    if (!user) throw new NotFoundException('User not found');

    //Check role matches
    if (user.roleId !== assignLoanDto.roleId) {
      throw new BadRequestException('User role does not match roleId provided');
    }

    return this.assign({
      loanId: loan.id,
      userId: user.id,
      roleId: assignLoanDto.roleId,
      assignedBy: userId,
    });

  }

  private async assign({ loanId, userId, roleId, assignedBy }) {
    // Find current active assignment for this role
    const currentAssignment = await this.prisma.loanAssignment.findFirst({
      where: { loanId, roleId, isActive: true },
    });

    // If the same user is already assigned → nothing to do
    if (currentAssignment?.userId === userId) {
      throw new BadRequestException('User already assigned to this loan');
    }

    // If there is a current assignment → unassign old user
    if (currentAssignment) {
      await this.unassign({ loanId, roleId, assignedBy });
    }

    // Assign new user
    return this.assignNew({ loanId, userId: userId, roleId, assignedBy });
  }

  private async assignNew({ loanId, userId, roleId, assignedBy }) {
    await this.prisma.loanAssignment.create({
      data: { loanId, userId, roleId, isActive: true },
    });

    await logAssignmentHistory({ prisma: this.prisma, loanId, userId, roleId, action: 'assigned', assignedBy });

    return { loanId, userId, roleId, action: 'assigned' };
  }


  private async unassign({
    loanId,
    roleId,
    assignedBy,
  }: {
    loanId: number;
    roleId: number;
    assignedBy: number;
  }) {
    // Find current active assignment
    const currentAssignment = await this.prisma.loanAssignment.findFirst({
      where: { loanId, roleId, isActive: true },
    });
    if (!currentAssignment) throw new BadRequestException('No active assignment found');

    // Deactivate
    await this.prisma.loanAssignment.update({
      where: { id: currentAssignment.id },
      data: { isActive: false, unassignedAt: new Date() },
    });

    // Log history
    await logAssignmentHistory({ prisma: this.prisma, loanId, userId: currentAssignment.userId, roleId, action: 'unassigned', assignedBy });
    return { loanId, userId: currentAssignment.userId, roleId, action: 'unassigned' };
  }
}
