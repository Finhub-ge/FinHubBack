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
import { Committee_status, Committee_type, Loan, LoanVisit_status, SmsHistory_status, StatusMatrix_entityType, TeamMembership_teamRole } from '@prisma/client';
import { AssignLoanDto } from './dto/assignLoan.dto';
import { prepareLoanExportData, getCurrentAssignment, getPaymentSchedule, handleCommentsForReassignment, isTeamLead, logAssignmentHistory, calculateRemainingChanges, buildLoanSearchWhere, getLatestLoanIds } from 'src/helpers/loan.helper';
import { CreateCommitteeDto } from './dto/createCommittee.dto';
import { AddLoanMarksDto } from './dto/addLoanMarks.dto';
import { Role } from 'src/enums/role.enum';
import { AddLoanLegalStageDto } from './dto/addLoanLegalStage.dto';
import { AddLoanCollateralStatusDto } from './dto/addLoanCollateralStatus.dto';
import { AddLoanLitigationStageDto } from './dto/addLoanLitigationStage.dto';
import { AddAddressDto } from './dto/addAddress.dto';
import { UpdateAddressDto } from './dto/updateAddress.dto';
import { AddVisitDto } from './dto/addVisit.dto';
import { UpdateVisitDto } from './dto/updateVisit.dto';
import { GetLoansFilterDto, GetLoansFilterWithPaginationDto } from './dto/getLoansFilter.dto';
import { UploadsHelper } from 'src/helpers/upload.helper';
import { generatePdfFromHtml, getPaymentScheduleHtml } from 'src/helpers/pdf.helper';
import { PermissionsHelper } from 'src/helpers/permissions.helper';
import { statusToId } from 'src/enums/visitStatus.enum';
import { UpdatePortfolioGroupDto } from './dto/updatePortfolioGroup.dto';
import { PaginatedResult, PaginationService } from 'src/common';
import { generateExcel } from 'src/helpers/excel.helper';
import { LoanStatusGroups } from 'src/enums/loanStatus.enum';
import dayjs from 'dayjs';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
    private readonly paymentsHelper: PaymentsHelper,
    private readonly utilsHelper: UtilsHelper,
    private readonly uploadsHelper: UploadsHelper,
    private readonly permissionsHelper: PermissionsHelper,
    private readonly paginationService: PaginationService,

  ) { }

  async getAll(filterDto: GetLoansFilterWithPaginationDto): Promise<PaginatedResult<Loan>> {
    const { page, limit, columns, showClosedLoans, showOnlyClosedLoans, ...filters } = filterDto;

    const paginationParams = columns
      ? {}
      : this.paginationService.getPaginationParams({ page, limit });

    const where: any = { deletedAt: null };

    if (showOnlyClosedLoans) {
      where.statusId = { in: LoanStatusGroups.CLOSED };

      if (filters.search) {
        const searchWhere = buildLoanSearchWhere(filters.search);

        where.AND = where.AND || [];
        where.AND.push({ OR: searchWhere });
      }
      if (filters.portfolio?.length) where.groupId = { in: filters.portfolio };
      if (filters.portfolioseller?.length) {
        where.Portfolio = { portfolioSeller: { id: { in: filters.portfolioseller } } };
      }

      // Assigned users (collectors, lawyers, etc.)
      if (
        filters.assigneduser?.length ||
        filters.assignedlawyer?.length ||
        filters.assignedjuniorLawyer?.length ||
        filters.assignedexecutionLawyer?.length
      ) {
        const assignedIds = [
          ...(filters.assigneduser || []),
          ...(filters.assignedlawyer || []),
          ...(filters.assignedjuniorLawyer || []),
          ...(filters.assignedexecutionLawyer || []),
        ];

        where.LoanAssignment = {
          some: {
            isActive: true,
            User: { id: { in: assignedIds } },
          },
        };
      }

      if (filters.closedDateStart || filters.closedDateEnd) {
        const closedDateCondition: any = {};
        if (filters.closedDateStart)
          closedDateCondition.gte = dayjs(filters.closedDateStart).startOf('day').toDate();
        if (filters.closedDateEnd)
          closedDateCondition.lte = dayjs(filters.closedDateEnd).endOf('day').toDate();
        where.closedAt = closedDateCondition;
      }
    } else if (!showClosedLoans && !filters.search) {
      where.statusId = { notIn: LoanStatusGroups.CLOSED };
    }

    if (filters.search) {
      const searchWhere = buildLoanSearchWhere(filters.search);
      where.AND = where.AND || [];
      where.AND.push({ OR: searchWhere });
    }
    if (filters.portfolio?.length) where.groupId = { in: filters.portfolio };
    if (filters.loanstatus?.length) where.statusId = { in: filters.loanstatus };
    if (filters.portfolioseller?.length) {
      where.Portfolio = { portfolioSeller: { id: { in: filters.portfolioseller } } };
    }

    if (filters.clientStatus?.length) {
      where.Debtor = { DebtorStatus: { id: { in: filters.clientStatus } } };
    }

    // Active assignment filter
    if (
      filters.assigneduser?.length ||
      filters.assignedlawyer?.length ||
      filters.assignedjuniorLawyer?.length ||
      filters.assignedexecutionLawyer?.length
    ) {
      const assignedIds = [
        ...(filters.assigneduser || []),
        ...(filters.assignedlawyer || []),
        ...(filters.assignedjuniorLawyer || []),
        ...(filters.assignedexecutionLawyer || []),
      ];

      where.LoanAssignment = {
        some: {
          isActive: true,
          User: { id: { in: assignedIds } },
        },
      };
    }

    if (filters.actDays) where.actDays = { gt: filters.actDays };

    const loanIdsToFilter: Set<string> = new Set();

    if (filters.collateralstatus?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanCollateralStatus', 'collateralStatus', filters.collateralstatus);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    if (filters.city?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanAddress', 'city', filters.city);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    if (filters.visitStatus?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanVisit', 'status', filters.visitStatus);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    if (filters.litigationstage?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanLitigationStage', 'litigationStage', filters.litigationstage);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    if (filters.legalstage?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanLegalStage', 'legalStage', filters.legalstage);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    if (filters.marks?.length) {
      const ids = await getLatestLoanIds(this.prisma, 'LoanMarks', 'mark', filters.marks);
      ids.forEach((id) => loanIdsToFilter.add(id));
    }

    // Apply the subquery filter result (if any filters triggered)
    if (loanIdsToFilter.size > 0) {
      where.id = { in: Array.from(loanIdsToFilter) };
    } else if (filters.legalstage?.length) {
      return this.paginationService.createPaginatedResult([], 0, { page, limit });
    }

    const [data, total] = await Promise.all([
      this.permissionsHelper.loan.findMany({
        where,
        ...paginationParams,
        orderBy: { actDays: 'desc' },
        include: {
          Portfolio: {
            select: {
              id: true,
              name: true,
              portfolioSeller: { select: { id: true, name: true } },
            },
          },
          PortfolioCaseGroup: { select: { id: true, groupName: true } },
          Debtor: {
            select: {
              firstName: true,
              lastName: true,
              idNumber: true,
              DebtorStatus: { select: { id: true, name: true } },
            },
          },
          LoanStatus: { select: { id: true, name: true } },
          LoanAssignment: {
            where: { isActive: true },
            select: {
              createdAt: true,
              User: { select: { id: true, firstName: true, lastName: true } },
              Role: { select: { name: true } },
            },
          },
          LoanCollateralStatus: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { CollateralStatus: { select: { id: true, title: true } } },
          },
          LoanLitigationStage: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { LitigationStage: { select: { id: true, title: true } } },
          },
          LoanLegalStage: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { LegalStage: { select: { id: true, title: true } } },
          },
          LoanMarks: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { Marks: { select: { id: true, title: true } } },
          },
          LoanAddress: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              address: true,
              type: true,
              City: { select: { id: true, city: true } },
            },
          },
          LoanVisit: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            where: { deletedAt: null },
            select: {
              id: true,
              status: true,
              comment: true,
              LoanAddress: { select: { id: true, address: true } },
            },
          },
          LoanRemaining: {
            where: { deletedAt: null },
          },
        },
      }),
      this.permissionsHelper.loan.count({ where }),
    ]);

    if (columns) {
      return this.paginationService.getAllWithoutPagination(data, total);
    }

    if (showOnlyClosedLoans) {
      await Promise.all(
        data.map(async (loan) => {
          loan.totalPayments = await this.paymentsHelper.getTotalPaymentsByPublicId(loan.publicId);
        })
      );

      await Promise.all(
        data.map(async (loan) => {
          const remainingHistory = await this.prisma.loanRemaining.findMany({
            where: { loanId: loan.id },
            orderBy: { createdAt: 'asc' },
          });
          loan.remainingChanges = calculateRemainingChanges(remainingHistory);
        })
      );
    }

    return this.paginationService.createPaginatedResult(data, total, { page, limit });
  }

  async getOne(publicId: ParseUUIDPipe, user: any) {
    const loan = await this.permissionsHelper.loan.findFirst({
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
            idNumber: true,
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
                notes: true,
                labelId: true,
                createdAt: true,
                updatedAt: true,
                ContactType: { select: { name: true } },
                ContactLabel: { select: { name: true } },
              },
              orderBy: { labelId: 'asc' }
            },
            DebtorRealEstate: true,
            DebtorGuarantors: true,
          }
        },
        LoanStatus: {
          select: {
            name: true,
            description: true,
            createdAt: true
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
          where: user.role_name === Role.COLLECTOR && !isTeamLead(user) ? {
            // Collectors: exclude other collectors' archived comments
            NOT: {
              AND: [
                { archived: true }, // Is archived
                { userId: { not: user.id } }, // Not their own
                { User: { Role: { name: Role.COLLECTOR } } } // Is from a collector
              ]
            },
            deletedAt: null
          } : {
            // Non-collectors: see ALL comments
            deletedAt: null
          },
          select: {
            id: true,
            comment: true,
            createdAt: true,
            archived: true,
            archivedAt: true,
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
        Tasks: {
          select: {
            id: true,
            loanId: true,
            task: true,
            response: true,
            fromUser: true,
            toUserId: true,
            deadline: true,
            status: true,
            createdAt: true,
            User_Tasks_fromUserToUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            User_Tasks_toUserIdToUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
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
        PaymentCommitment: true,
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
        LoanAddress: {
          where: { deletedAt: null },
          select: {
            id: true,
            address: true,
            type: true,
            City: { select: { id: true, city: true } },
            User: { select: { id: true, firstName: true, lastName: true } },
            createdAt: true,
          }
        },
        LoanVisit: {
          orderBy: { createdAt: 'desc' },
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            comment: true,
            User: { select: { id: true, firstName: true, lastName: true } },
            createdAt: true,
            updatedAt: true,
            LoanAddress: { select: { id: true, address: true } },
          }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    let activeCommitments = [];
    if (
      loan?.LoanStatus &&
      (
        ['Agreement', 'Promised to pay'].includes(loan.LoanStatus.name) ||
        LoanStatusGroups.CLOSED.includes(Number(loan.statusId))
      )
    ) {
      activeCommitments = await getPaymentSchedule(loan.id);
    } else {
      activeCommitments = null;
    }

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

    // Create the new contact
    await this.prisma.debtorContact.create({
      data: {
        debtorId: debtor.id,
        typeId: createContactDto.typeId,
        value: createContactDto.value,
        labelId: createContactDto.labelId,
        isPrimary: createContactDto.labelId === 1 ? true : createContactDto.isPrimary || false,
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
    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        actDays: 0,
      },
    });
    return {
      message: 'Comment added successfully',
    };
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
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        LoanStatus: true
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const status = await this.prisma.loanStatus.findUnique({
      where: { id: updateLoanStatusDto.statusId },
    });

    if (!status) {
      throw new NotFoundException('Status not found');
    }

    // Check StatusMatrix - is this transition allowed?
    const isTransitionAllowed = await this.prisma.statusMatrix.findFirst({
      where: {
        entityType: 'LOAN',
        fromStatusId: loan.LoanStatus.id,
        toStatusId: updateLoanStatusDto.statusId,
        isAllowed: true,
        deletedAt: null,
      },
    });

    if (!isTransitionAllowed) {
      throw new BadRequestException(
        `Status transition from ${loan.LoanStatus.name} status to ${status.name} is not allowed`
      );
    }

    // Check if reason is required
    if (isTransitionAllowed.requiresReason === true && !updateLoanStatusDto.comment) {
      throw new BadRequestException(
        'Reason/comment is required for this status change'
      );
    }

    if (status.name === 'Agreement') {
      if (!updateLoanStatusDto.agreement) {
        throw new BadRequestException('Agreement data is required for agreement status');
      }
      const currentDebt = await this.prisma.loanRemaining.findFirst({
        where: { loanId: loan.id, deletedAt: null },
      });

      // Convert Decimal to number with 2 decimal precision
      const currentDebtAmount = Number(Number(currentDebt.currentDebt).toFixed(2));

      // Validate schedule
      const adjustedSchedule = await this.paymentsHelper.validateAndAdjustPaymentSchedule(
        updateLoanStatusDto.agreement.schedule,
        updateLoanStatusDto.agreement.agreedAmount,
        updateLoanStatusDto.agreement.numberOfMonths,
        currentDebtAmount
      );

      // Store adjusted schedule for use in transaction
      updateLoanStatusDto.agreement.schedule = adjustedSchedule;

      const transactions = await this.paymentsHelper.getTransactionByLoanId(loan.id);
      if (transactions.length === 0) {
        throw new BadRequestException('Cannot update loan status without transactions');
      }
    }

    if (status.name === 'Promised To Pay') {
      if (!updateLoanStatusDto.promise) {
        throw new BadRequestException('Promise data is required for promise status');
      }

      const currentDebt = await this.prisma.loanRemaining.findFirst({
        where: { loanId: loan.id, deletedAt: null },
      });

      if (!currentDebt) {
        throw new NotFoundException('Loan remaining data not found');
      }

      const currentDebtAmount = Number(Number(currentDebt.currentDebt).toFixed(2));
      const promiseAmount = Number(Number(updateLoanStatusDto.promise.agreedAmount).toFixed(2));

      if (promiseAmount > currentDebtAmount) {
        throw new BadRequestException('Amount must be less or equal to current debt');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Create history record
      await tx.loanStatusHistory.create({
        data: {
          loanId: loan.id,
          oldStatusId: loan.LoanStatus.id,
          newStatusId: updateLoanStatusDto.statusId,
          changedBy: userId,
          notes: updateLoanStatusDto.comment ?? null,
        },
      });

      // Handle Agreement status
      if (status.name === 'Agreement') {
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
          tx
        );

        // Save the schedule from frontend
        await this.paymentsHelper.savePaymentSchedule(
          {
            commitmentId: commitment.id,
            schedules: updateLoanStatusDto.agreement.schedule,
          },
          tx
        );
      }

      // Handle Promise status
      if (status.name === 'Promised To Pay') {
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
          },
          tx
        );
      }

      if (status.name === 'Agreement Canceled') {
        await tx.paymentCommitment.updateMany({
          where: { loanId: loan.id, isActive: 1 },
          data: { isActive: 0 },
        });
      }

      // Update loan status
      await tx.loan.update({
        where: { publicId: String(publicId) },
        data: { statusId: updateLoanStatusDto.statusId },
      });
    });

    return {
      message: 'Loan status updated successfully',
    };
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
      select: {
        id: true,
        LoanVisit: {
          where: { deletedAt: null },
          select: {
            status: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // If no userId provided → unassign
    if (!assignLoanDto.userId) {
      return this.unassign({ loanId: loan.id, roleId: assignLoanDto.roleId, assignedBy: userId, });
    }

    const user = await this.prisma.user.findUnique({ where: { id: assignLoanDto.userId, isActive: true, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    //Check role matches
    if (user.roleId !== assignLoanDto.roleId) {
      throw new BadRequestException('User role does not match roleId provided');
    }

    // Check if any visit is pending
    const hasPendingVisit = loan.LoanVisit.some(visit => visit.status === LoanVisit_status.pending);
    if (hasPendingVisit) {
      throw new BadRequestException('Cannot proceed while any visit is still pending');
    }

    const currentAssignment = await getCurrentAssignment(loan.id, assignLoanDto.roleId, this.prisma);


    return await this.prisma.$transaction(async (tx) => {
      // user.id is the new user id
      // userId is the assigned by user id
      await handleCommentsForReassignment(loan.id, assignLoanDto.roleId, user.id, userId, currentAssignment, tx);

      return await this.assign({
        loanId: loan.id,
        userId: user.id,
        roleId: assignLoanDto.roleId,
        assignedBy: userId,
        tx
      });
    });
  }

  private async assign({ loanId, userId, roleId, assignedBy, tx = null }) {
    const dbClient = tx || this.prisma;
    // Find current active assignment for this role
    const currentAssignment = await dbClient.loanAssignment.findFirst({
      where: { loanId, roleId, isActive: true },
    });

    // If the same user is already assigned → nothing to do
    if (currentAssignment?.userId === userId) {
      throw new BadRequestException('User already assigned to this loan');
    }

    // If there is a current assignment → unassign old user
    if (currentAssignment) {
      await this.unassign({ loanId, roleId, assignedBy, tx });
    }

    // Assign new user
    return this.assignNew({ loanId, userId: userId, roleId, assignedBy, tx });
  }

  private async assignNew({ loanId, userId, roleId, assignedBy, tx = null }) {
    const dbClient = tx || this.prisma;
    await dbClient.loanAssignment.create({
      data: { loanId, userId, roleId, isActive: true },
    });

    await logAssignmentHistory({ prisma: dbClient, loanId, userId, roleId, action: 'assigned', assignedBy });

    return { loanId, userId, roleId, action: 'assigned' };
  }

  private async unassign({
    loanId,
    roleId,
    assignedBy,
    tx = null
  }: {
    loanId: number;
    roleId: number;
    assignedBy: number;
    tx?: any;
  }) {
    const dbClient = tx || this.prisma;
    // Find current active assignment
    const currentAssignment = await dbClient.loanAssignment.findFirst({
      where: { loanId, roleId, isActive: true },
    });
    if (!currentAssignment) throw new BadRequestException('No active assignment found');

    // Deactivate
    await dbClient.loanAssignment.update({
      where: { id: currentAssignment.id },
      data: { isActive: false, unassignedAt: new Date() },
    });

    // Log history
    await logAssignmentHistory({ prisma: dbClient, loanId, userId: currentAssignment.userId, roleId, action: 'unassigned', assignedBy });
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

  async addAddress(publicId: ParseUUIDPipe, data: AddAddressDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the city exists
    const city = await this.prisma.city.findUnique({
      where: { id: data.cityId },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    // Create the loan address
    await this.prisma.loanAddress.create({
      data: {
        loanId: loan.id,
        cityId: data.cityId,
        type: data.type,
        address: data.address,
        userId: userId,
      },
    });

    return {
      message: 'Address added successfully'
    };
  }

  async updateAddress(publicId: ParseUUIDPipe, addressId: number, data: UpdateAddressDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the address exists and belongs to this loan
    const existingAddress = await this.prisma.loanAddress.findFirst({
      where: {
        id: addressId,
        loanId: loan.id,
        deletedAt: null
      },
    });

    if (!existingAddress) {
      throw new NotFoundException('Address not found');
    }

    // If cityId is being updated, verify the city exists
    if (data.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: data.cityId },
      });

      if (!city) {
        throw new NotFoundException('City not found');
      }
    }

    // Update the address
    await this.prisma.loanAddress.update({
      where: { id: addressId },
      data: {
        ...data
      },
    });

    return {
      message: 'Address updated successfully'
    };
  }

  async deleteAddress(publicId: ParseUUIDPipe, addressId: number, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the address exists and belongs to this loan
    const existingAddress = await this.prisma.loanAddress.findFirst({
      where: {
        id: addressId,
        loanId: loan.id,
        deletedAt: null
      },
    });

    if (!existingAddress) {
      throw new NotFoundException('Address not found');
    }

    // Soft delete the address
    await this.prisma.loanAddress.update({
      where: { id: addressId },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Address deleted successfully'
    };
  }

  async downloadSchedulePdfBuffer(publicId: ParseUUIDPipe): Promise<{ buffer: Buffer, caseId: number }> {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    //Get commitments with payment schedules & balances
    const commitments = await getPaymentSchedule(loan.id);

    //Generate HTML
    const html = getPaymentScheduleHtml(loan, commitments);

    //Convert HTML → PDF and return buffer
    const pdfBuffer = await generatePdfFromHtml(html);
    return {
      buffer: pdfBuffer,
      caseId: loan.caseId,
    };
  }

  async getAddress(publicId: ParseUUIDPipe, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    const address = await this.prisma.loanAddress.findMany({
      where: { loanId: loan.id, deletedAt: null },
      select: {
        id: true,
        address: true,
        type: true,
        City: { select: { id: true, city: true } },
        User: { select: { id: true, firstName: true, lastName: true } },
        createdAt: true,
      },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return {
      address: address,
    };
  }

  async addVisit(publicId: ParseUUIDPipe, data: AddVisitDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        LoanVisit: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
          }
        }
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Check StatusMatrix - is this transition allowed?
    const isTransitionAllowed = await this.prisma.statusMatrix.findFirst({
      where: {
        entityType: 'LOAN_VISIT',
        fromStatusId: statusToId[loan.LoanVisit[0]?.status || 'n_a'],
        toStatusId: statusToId[data.status],
        isAllowed: true,
        deletedAt: null,
      },
    });

    if (!isTransitionAllowed) {
      throw new BadRequestException(
        `Status transition from ${loan.LoanVisit[0]?.status || 'N/A'} status to ${data.status} is not allowed`
      );
    }

    // Check if reason is required
    if (isTransitionAllowed.requiresReason === true && !data.comment) {
      throw new BadRequestException(
        'Reason/comment is required for this status change'
      );
    }

    // Create the loan visit
    await this.prisma.loanVisit.create({
      data: {
        loanId: loan.id,
        status: data.status,
        comment: data.comment,
        userId: userId,
        loanAddressId: data.addressId,
      },
    });

    return {
      message: 'Visit added successfully'
    };
  }

  async updateVisit(publicId: ParseUUIDPipe, visitId: number, data: UpdateVisitDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Verify the visit exists and belongs to this loan
    const existingVisit = await this.prisma.loanVisit.findFirst({
      where: {
        id: visitId,
        loanId: loan.id,
        deletedAt: null
      },
    });

    if (!existingVisit) {
      throw new NotFoundException('Visit not found');
    }

    // Check if user is NOT the creator OR visit has expired
    if (existingVisit.userId !== userId || existingVisit.expiredAt !== null) {
      throw new BadRequestException('You can only edit your own non-expired visits');
    }

    // Update the visit with only provided fields
    await this.prisma.loanVisit.update({
      where: { id: visitId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });

    return {
      message: 'Visit updated successfully'
    };
  }

  async getAvailableStatuses(
    publicId: ParseUUIDPipe,
    entityType: StatusMatrix_entityType
  ) {
    let currentStatusId: number;
    let currentStatusName: string;

    // Get current status based on entity type
    if (entityType === 'LOAN') {
      const loan = await this.prisma.loan.findUnique({
        where: { publicId: String(publicId), deletedAt: null },
        include: { LoanStatus: true },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      currentStatusId = loan.statusId;
      currentStatusName = loan.LoanStatus.name;
    } else if (entityType === 'LOAN_VISIT') {
      const loan = await this.prisma.loan.findUnique({
        where: { publicId: String(publicId), deletedAt: null }
      });

      const visit = await this.prisma.loanVisit.findFirst({
        where: { loanId: loan.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!visit) {
        return
      }

      // Map enum to ID
      const visitStatusToId = {
        'n_a': 1,
        'pending': 2,
        'completed': 3,
        'canceled': 4,
      };

      currentStatusId = visitStatusToId[visit.status];
      currentStatusName = visit.status;
    }

    // Get allowed transitions from StatusMatrix
    const allowedStatuses = await this.prisma.statusMatrix.findMany({
      where: {
        entityType,
        fromStatusId: currentStatusId,
        isAllowed: true,
        deletedAt: null,
      },
    });

    // Get status details
    let statusDetails: any[] = [];

    if (entityType === 'LOAN') {
      const toStatusIds = allowedStatuses.map(t => t.toStatusId);
      statusDetails = await this.prisma.loanStatus.findMany({
        where: { id: { in: toStatusIds } },
      });
    } else if (entityType === 'LOAN_VISIT') {
      // For visits, map IDs back to enum names
      const visitIdToStatus = {
        1: 'n_a',
        2: 'pending',
        3: 'completed',
        4: 'canceled',
      };

      statusDetails = allowedStatuses.map(t => ({
        id: t.toStatusId,
        name: visitIdToStatus[t.toStatusId],
      }));
    }

    return {
      allowedStatuses: allowedStatuses.map(transition => {
        const status = statusDetails.find(s => s.id === transition.toStatusId);
        return {
          statusId: transition.toStatusId,
          status: status?.name,
          requiresReason: transition.requiresReason === true,
          description: transition.description,
        };
      }),
    };
  }

  async updatePortfolioGroup(publicId: ParseUUIDPipe, userId: number, updatePortfolioGroupDto: UpdatePortfolioGroupDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: { groupId: updatePortfolioGroupDto.groupId },
    });

    return {
      message: 'Portfolio group updated successfully'
    };
  }

  async exportLoans(filterDto: GetLoansFilterDto) {
    const loans = await this.getAll(filterDto);

    const loanExportData = loans.data.map(loan => prepareLoanExportData(loan));

    return await generateExcel(loanExportData, filterDto.columns, 'Loans Report');
  }
}