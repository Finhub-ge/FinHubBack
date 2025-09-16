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
import { Committee_status, Committee_type, SmsHistory_status } from '@prisma/client';
import { AssignLoanDto } from './dto/assignLoan.dto';
import { logAssignmentHistory } from 'src/helpers/loan.helper';
import { CreateCommitteeDto } from './dto/createCommittee.dto';
import { AddLoanMarksDto } from './dto/addLoanMarks.dto';
import { Role } from 'src/enums/role.enum';
import { AddLoanLegalStageDto } from './dto/addLoanLegalStage.dto';
import { AddLoanCollateralStatusDto } from './dto/addLoanCollateralStatus.dto';
import { AddLoanLitigationStageDto } from './dto/addLoanLitigationStage.dto';
import { GetLoansFilterDto } from './dto/getLoansFilter.dto';
import { UploadsHelper } from 'src/helpers/upload.helper';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
    private readonly paymentsHelper: PaymentsHelper,
    private readonly utilsHelper: UtilsHelper,
    private readonly uploadsHelper: UploadsHelper
  ) { }

  async getAll(filters: GetLoansFilterDto) {
    const where: any = { deletedAt: null };

    if (filters.caseId) where.caseId = filters.caseId;
    if (filters.portfolio?.length) where.portfolioId = { in: filters.portfolio };
    if (filters.loanstatus?.length) where.statusId = { in: filters.loanstatus };

    if (filters.portfolioseller?.length) {
      where.Portfolio = { portfolioSeller: { id: { in: filters.portfolioseller } } };
    }

    if (filters.assigneduser?.length) {
      where.LoanAssignment = {
        some: {
          isActive: true,
          User: { id: { in: filters.assigneduser } }
        }
      };
    }

    if (filters.collateralstatus?.length) {
      where.LoanCollateralStatus = { some: { CollateralStatus: { id: { in: filters.collateralstatus } } } };
    }
    if (filters.litigationstage?.length) {
      where.LoanLitigationStage = { some: { LitigationStage: { id: { in: filters.litigationstage } } } };
    }
    if (filters.legalstage?.length) {
      where.LoanLegalStage = { some: { LegalStage: { id: { in: filters.legalstage } } } };
    }
    if (filters.marks?.length) {
      where.LoanMarks = { some: { Marks: { id: { in: filters.marks } } } };
    }

    const loans = await this.prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Portfolio: {
          select: {
            id: true,
            name: true,
            portfolioSeller: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        Debtor: {
          select: {
            firstName: true,
            lastName: true,
            idNumber: true,
            DebtorStatus: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        LoanStatus: {
          select: {
            id: true,
            name: true,
          }
        },
        LoanAssignment: {
          where: { isActive: true },
          select: {
            createdAt: true,
            User: {
              select: {
                id: true,
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
        },
        LoanCollateralStatus: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            CollateralStatus: { select: { id: true, title: true } },
          }
        },
        LoanLitigationStage: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            LitigationStage: { select: { id: true, title: true } },
          }
        },
        LoanLegalStage: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            LegalStage: { select: { id: true, title: true } },
          }
        },
        LoanMarks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            Marks: { select: { id: true, title: true } },
          }
        }
      }
    });

    return loans;
  }

  async getOne(publicId: ParseUUIDPipe, user: any) {
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
              where: { deletedAt: null },
              select: {
                id: true,
                value: true,
                isPrimary: true,
                notes: true,
                ContactType: { select: { name: true } },
                ContactLabel: { select: { name: true } },
              },
            },
            DebtorRealEstate: true,
            DebtorGuarantors: true,
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
                lastName: true,
                Role: true
              }
            },
            Uploads: {
              select: {
                id: true,
                originalFileName: true,
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
        },
        Committee: {
          select: {
            requestDate: true,
            User_Committee_requesterIdToUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            requestText: true,
            User_Committee_responderIdToUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            responseText: true,
            responseDate: true,
            agreementMinAmount: true,
            status: true,
            Uploads: {
              select: {
                id: true,
                originalFileName: true,
              }
            }
          }
        },
        LoanMarks: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            comment: true,
            deadline: true,
            createdAt: true,
            Marks: {
              select: {
                title: true,
              }
            }
          }
        },
        LoanLegalStage: {
          select: {
            comment: true,
            createdAt: true,
            LegalStage: { select: { title: true } },
            User: { select: { firstName: true, lastName: true } },
          }
        },
        LoanCollateralStatus: {
          select: {
            comment: true,
            createdAt: true,
            CollateralStatus: { select: { title: true } },
            User: { select: { firstName: true, lastName: true } },
          }
        },
        LoanLitigationStage: {
          select: {
            comment: true,
            createdAt: true,
            LitigationStage: { select: { title: true } },
            User: { select: { firstName: true, lastName: true } },
          }
        },
        LoanRemaining: {
          where: { deletedAt: null },
        },
        Transaction: true,
        PaymentCommitment: true
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

    let comments = loan.Comments;
    let lawyerComments = [];

    if (user.role_name === Role.LAWYER) {
      lawyerComments = comments.filter(c => c.User.Role.name === Role.LAWYER);
      comments = comments.filter(c => c.User.Role.name !== Role.LAWYER);
    }

    const { Comments, ...loanData } = loan;

    const initialClaimBreakdown = {
      initPrincipal: loan.principal,
      initInterest: loan.interest,
      initPenalty: loan.penalty,
      initOtherFee: loan.otherFee,
      initLegalCharges: loan.legalCharges,
      initDebt: loan.totalDebt,
    };

    const totalPayments = await this.paymentsHelper.getTotalPaymentsByPublicId(publicId);

    return {
      ...loanData,
      comments,
      lawyerComments,
      activeCommitments,
      initialClaimBreakdown,
      totalPayments
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

  async editDebtorContact(publicId: ParseUUIDPipe, contactId: number, createContactDto: CreateContactDto, userId: number) {
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

    // Check if the contact exists and belongs to this debtor
    const existingContact = await this.prisma.debtorContact.findUnique({
      where: {
        id: contactId,
        debtorId: debtor.id,
        deletedAt: null
      }
    });

    if (!existingContact) {
      throw new NotFoundException('Contact not found');
    }

    // If this is marked as primary, update other contacts to not be primary
    if (createContactDto.isPrimary) {
      await this.prisma.debtorContact.updateMany({
        where: {
          debtorId: debtor.id,
          id: { not: contactId },
          deletedAt: null
        },
        data: { isPrimary: false }
      });
    }

    // Update the existing contact
    await this.prisma.debtorContact.update({
      where: { id: contactId },
      data: {
        typeId: createContactDto.typeId,
        value: createContactDto.value,
        labelId: createContactDto.labelId,
        isPrimary: createContactDto.isPrimary || false,
        notes: createContactDto.notes,
        updatedAt: new Date(),
        // Don't update userId - keep the original creator, or add updatedBy field if you have one
      },
      include: {
        ContactType: { select: { id: true, name: true } },
        ContactLabel: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return { message: 'Debtor contact updated successfully' };
  }

  async deleteDebtorContact(publicId: string, contactId: number, userId: number) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: publicId, deletedAt: null }
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

    // Check if the contact exists and belongs to this debtor
    const existingContact = await this.prisma.debtorContact.findUnique({
      where: {
        id: contactId,
        debtorId: debtor.id,
        deletedAt: null
      }
    });

    if (!existingContact) {
      throw new NotFoundException('Contact not found');
    }

    // Check if this is the only contact - prevent deletion if it's the last one
    const contactCount = await this.prisma.debtorContact.count({
      where: {
        debtorId: debtor.id,
        deletedAt: null
      }
    });

    if (contactCount === 1) {
      throw new BadRequestException('Cannot delete the last contact. Debtor must have at least one contact.');
    }

    // If deleting a primary contact, set another contact as primary
    if (existingContact.isPrimary) {
      const nextContact = await this.prisma.debtorContact.findFirst({
        where: {
          debtorId: debtor.id,
          id: { not: contactId },
          deletedAt: null
        },
        orderBy: { createdAt: 'asc' } // Set the oldest remaining contact as primary
      });

      if (nextContact) {
        await this.prisma.debtorContact.update({
          where: { id: nextContact.id },
          data: { isPrimary: true }
        });
      }
    }

    // Soft delete the contact
    await this.prisma.debtorContact.update({
      where: { id: contactId },
      data: {
        deletedAt: new Date(),
      }
    });

    return {
      message: 'Debtor contact deleted successfully'
    };
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

  async addComment(publicId: ParseUUIDPipe, addCommentDto: AddCommentDto, userId: number, file?: Express.Multer.File) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    let upload = null;

    if (file) {
      upload = await this.uploadsHelper.uploadFile(file, `loans/${loan.id}/comments`);
    }

    // Create the comment
    await this.prisma.comments.create({
      data: {
        loanId: loan.id,
        userId,
        comment: addCommentDto.comment,
        uploadId: upload?.id,
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

  async requestCommittee(publicId: ParseUUIDPipe, createCommitteeDto: CreateCommitteeDto, userId: number, file?: Express.Multer.File) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    let upload = null;

    if (file) {
      upload = await this.uploadsHelper.uploadFile(file, `loans/${loan.id}/committee`);
    }

    await this.prisma.committee.create({
      data: {
        loanId: loan.id,
        requesterId: userId,
        principalAmount: loan.principal,
        requestText: createCommitteeDto.requestText,
        requestDate: new Date(),
        agreementMinAmount: createCommitteeDto.agreementMinAmount,
        type: Committee_type.none,
        status: Committee_status.pending,
        uploadId: upload?.id,
      },
    });

    return {
      message: 'Committee request created successfully',
    };
  }

  async addLoanMarks(publicId: ParseUUIDPipe, data: AddLoanMarksDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the mark exists
    const mark = await this.prisma.marks.findUnique({
      where: { id: data.markId },
    });
    if (!mark) {
      throw new NotFoundException('Mark not found');
    }

    // Create the relationship between loan and mark
    const loanMark = await this.prisma.loanMarks.create({
      data: {
        loanId: loan.id,
        markId: data.markId,
        comment: data.comment,
        deadline: data.deadline ? new Date(data.deadline) : null,
      },
    });

    return {
      message: 'Loan mark added successfully'
    };
  }

  async deleteLoanMark(publicId: ParseUUIDPipe, markId: number, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Find the loan mark relationship
    const loanMark = await this.prisma.loanMarks.findFirst({
      where: {
        loanId: loan.id,
        markId: markId,
        deletedAt: null,
      },
    });
    if (!loanMark) {
      throw new NotFoundException('Loan mark not found');
    }

    // Soft delete the loan mark relationship
    await this.prisma.loanMarks.update({
      where: { id: loanMark.id },
      data: { deletedAt: new Date() },
    });

    return {
      message: 'Loan mark deleted successfully'
    };
  }

  async addLoanLegalStage(publicId: ParseUUIDPipe, data: AddLoanLegalStageDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the legal stage exists
    const legalStage = await this.prisma.legalStage.findUnique({
      where: { id: data.stageId },
    });
    if (!legalStage) {
      throw new NotFoundException('Legal stage not found');
    }

    // Create the relationship between loan and legal stage
    await this.prisma.loanLegalStage.create({
      data: {
        loanId: loan.id,
        legalStageId: data.stageId,
        comment: data.comment,
        userId: userId,
      },
    });

    return {
      message: 'Loan legal stage added successfully'
    };
  }

  async addLoanCollateralStatus(publicId: ParseUUIDPipe, data: AddLoanCollateralStatusDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });


    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the collateral status exists
    const collateralStatus = await this.prisma.collateralStatus.findUnique({
      where: { id: data.collateralStatusId },
    });


    if (!collateralStatus) {
      throw new NotFoundException('Collateral status not found');
    }

    // Create the relationship between loan and collateral status
    await this.prisma.loanCollateralStatus.create({
      data: {
        loanId: loan.id,
        collateralStatusId: data.collateralStatusId,
        comment: data.comment,
        userId: userId,
      },
    });

    return {
      message: 'Loan collateral status added successfully'
    };
  }

  async addLoanLitigationStage(publicId: ParseUUIDPipe, data: AddLoanLitigationStageDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the litigation stage exists
    const litigationStage = await this.prisma.litigationStage.findUnique({
      where: { id: data.litigationStageId },
    });

    if (!litigationStage) {
      throw new NotFoundException('Litigation stage not found');
    }
    // Check if loan has a collateral status
    const existingCollateralStatus = await this.prisma.loanCollateralStatus.findFirst({
      where: { loanId: loan.id }
    });

    if (!existingCollateralStatus) {
      throw new BadRequestException('Loan must have a collateral status before adding litigation stage');
    }


    // Create the relationship between loan and litigation stage
    await this.prisma.loanLitigationStage.create({
      data: {
        loanId: loan.id,
        litigationStageId: data.litigationStageId,
        comment: data.comment,
        userId: userId,
      },
    });


    return {
      message: 'Loan litigation stage added successfully'
    };
  }
}