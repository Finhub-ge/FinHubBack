import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactDto } from './dto/createContact.dto';
import { AddLoanAttributesDto } from './dto/addLoanAttribute.dto';
import { AddCommentDto } from './dto/addComment.dto';
import { AddDebtorStatusDto } from './dto/addDebtorStatus.dto';
import { PaymentScheduleItemDto, UpdateLoanStatusDto } from './dto/updateLoanStatus.dto';
import { PaymentsHelper } from 'src/helpers/payments.helper';
import { SendSmsDto } from './dto/sendSms.dto';
import { UtilsHelper } from 'src/helpers/utils.helper';
import { Committee_status, Committee_type, Loan, LoanVisit_status, Prisma, PrismaClient, Reminders_type, SmsHistory_status, StatusMatrix_entityType, TeamMembership_teamRole } from '@prisma/client';
import { AssignLoanDto } from './dto/assignLoan.dto';
import { prepareLoanExportData, getCurrentAssignment, getPaymentSchedule, handleCommentsForReassignment, isTeamLead, logAssignmentHistory, saveScheduleReminders, buildCommentsWhereClause, calculateLoanSummaryNew, isRegionalManager, getRegionalTeamIds } from 'src/helpers/loan.helper';
import { CreateCommitteeDto } from './dto/createCommittee.dto';
import { AddLoanMarksDto } from './dto/addLoanMarks.dto';
import { LAWYER_ROLES, Role } from 'src/enums/role.enum';
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
import { generateExcel, generateExcelStream } from 'src/helpers/excel.helper';
import { LoanStatusGroups, LoanStatusId } from 'src/enums/loanStatus.enum';
import { applyClosedDateRangeFilter, applyClosedLoansFilter, applyCommonFilters, applyIntersectedIds, applyOpenLoansFilter, applyUserAssignmentFilter, attachLatestRecordsToLoans, batchCalculateWriteoffs, batchLoadLatestRecords, buildInitialWhereClause, buildLoanQuery, calculateLoanIdIntersection, fetchLatestRecordFilterIds, fetchLatestRecordFilterIds1, getLoanIncludeConfig, getLoanIncludeConfig1, hasEmptyFilterResults, hasLoanAssignmentInWhere, mapClosedLoansDataToPaymentWriteoff, mapClosedLoansDataToPaymentWriteoff1, shouldProcessIntersection } from 'src/helpers/loanFilter.helper';
import { AddLoanReminderDto } from './dto/addLoanReminder.dto';
import { DefaultArgs } from '@prisma/client/runtime/library';
import { daysFromDate, getMinutesAgo } from 'src/helpers/date.helper';
import { shouldSkipUserScope, calculateLoanSummary } from 'src/helpers/loan.helper';
import { UpdateCommentDto } from './dto/updateComment.dto';
import * as ExcelJS from 'exceljs';

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

  // async getAll1(filterDto: GetLoansFilterWithPaginationDto, user: any): Promise<PaginatedResult<Loan> & { summary?: any }> {
  //   const { page, limit, columns, showClosedLoans, showOnlyClosedLoans, ...filters } = filterDto;

  //   // Setup pagination
  //   const paginationParams = columns
  //     ? {}
  //     : this.paginationService.getPaginationParams({ page, limit });

  //   // Build base query
  //   const where = buildInitialWhereClause();

  //   // Apply appropriate filters
  //   if (showOnlyClosedLoans) {
  //     applyClosedLoansFilter(where, filters);
  //     applyClosedDateRangeFilter(where, filters);
  //   } else {
  //     applyOpenLoansFilter(where, filters, showClosedLoans);
  //   }

  //   applyCommonFilters(where, filters);

  //   // Get team member IDs if user is a collector team lead
  //   let teamMemberIds: number[] | undefined;
  //   if (user.role_name === Role.COLLECTOR && isTeamLead(user)) {
  //     const activeTeamMembership = user.team_membership?.find(tm => tm.deletedAt === null);
  //     if (activeTeamMembership) {
  //       const teamMembers = await this.prisma.teamMembership.findMany({
  //         where: {
  //           teamId: activeTeamMembership.teamId,
  //           deletedAt: null,
  //         },
  //         select: {
  //           userId: true,
  //         },
  //       });
  //       teamMemberIds = teamMembers.map(tm => tm.userId);
  //     }
  //   }

  //   applyUserAssignmentFilter(where, filters, user, teamMemberIds);

  //   // Handle complex filters with intersection ONLY if there are complex filters
  //   const relatedFilterIds = await fetchLatestRecordFilterIds1(this.prisma, filters);

  //   // Only process intersection if there are complex filters
  //   if (shouldProcessIntersection(relatedFilterIds)) {
  //     // If any filter returned empty results, return empty
  //     if (hasEmptyFilterResults(relatedFilterIds)) {
  //       return this.paginationService.createPaginatedResult([], 0, { page, limit });
  //     }

  //     // Calculate intersection
  //     const intersectedIds = calculateLoanIdIntersection(relatedFilterIds);

  //     // If no loans match all filters, return empty
  //     if (intersectedIds.length === 0) {
  //       return this.paginationService.createPaginatedResult([], 0, { page, limit });
  //     }

  //     // Apply intersection to where clause
  //     applyIntersectedIds(where, intersectedIds);
  //   }

  //   // Determine if we should skip user scope in permission helper
  //   // Skip only for team leads filtering by their own role type
  //   const skipUserScope = shouldSkipUserScope(user, filters);

  //   // Fetch loans
  //   const includeConfig = getLoanIncludeConfig1();
  //   const loanQuery = buildLoanQuery(where, paginationParams, includeConfig);

  //   // Add flag to skip user scope if needed
  //   if (skipUserScope) {
  //     loanQuery._skipUserScope = true;
  //   }

  //   const [loans, totalCount] = await Promise.all([
  //     this.permissionsHelper.loan.findMany(loanQuery),
  //     this.permissionsHelper.loan.count({ where, _skipUserScope: skipUserScope }),
  //   ]);

  //   // Enrich loans with actDays
  //   const enrichedLoans = loans.map(loan => ({
  //     ...loan,
  //     actDays: loan.lastActivite ? daysFromDate(loan.lastActivite) : null
  //   }));

  //   // Handle CSV export
  //   if (columns) {
  //     return this.paginationService.getAllWithoutPagination(enrichedLoans, totalCount);
  //   }

  //   // Enrich closed loans with additional data
  //   if (showOnlyClosedLoans) {
  //     await mapClosedLoansDataToPaymentWriteoff1(enrichedLoans, this.paymentsHelper);
  //   }

  //   // Calculate summary statistics (respects filters)
  //   const summary = await calculateLoanSummaryNew(this.permissionsHelper, where, skipUserScope);

  //   const paginatedResult = this.paginationService.createPaginatedResult(enrichedLoans, totalCount, { page, limit });

  //   // Add summary to response
  //   return {
  //     ...paginatedResult,
  //     summary,
  //   } as PaginatedResult<Loan> & { summary: any };
  // }

  async getAll(filterDto: GetLoansFilterWithPaginationDto, user: any): Promise<PaginatedResult<Loan>> {
    const { page, limit, columns } = filterDto;

    // Setup pagination
    const paginationParams = columns
      ? {}
      : this.paginationService.getPaginationParams({ page, limit });

    // Parallelize: Fetch team member IDs in parallel with filter processing
    const [teamMemberIds, filterResults] = await Promise.all([
      this.getTeamMemberIds(user),
      (async () => {
        const { showClosedLoans, showOnlyClosedLoans, ...filters } = filterDto;
        const where = buildInitialWhereClause();

        if (showOnlyClosedLoans) {
          applyClosedLoansFilter(where, filters);
          applyClosedDateRangeFilter(where, filters);
        } else {
          applyOpenLoansFilter(where, filters, showClosedLoans);
        }

        applyCommonFilters(where, filters);

        // Fetch complex filter IDs in parallel
        const relatedFilterIds = await fetchLatestRecordFilterIds(this.prisma, filters);

        return { where, filters, relatedFilterIds };
      })()
    ]);

    // Apply user assignment filter with the team member IDs we just fetched
    applyUserAssignmentFilter(filterResults.where, filterResults.filters, user, teamMemberIds);

    // Process filter intersection
    if (shouldProcessIntersection(filterResults.relatedFilterIds)) {
      if (hasEmptyFilterResults(filterResults.relatedFilterIds)) {
        return this.paginationService.createPaginatedResult([], 0, { page, limit });
      }

      const intersectedIds = calculateLoanIdIntersection(filterResults.relatedFilterIds);
      if (intersectedIds.length === 0) {
        return this.paginationService.createPaginatedResult([], 0, { page, limit });
      }

      applyIntersectedIds(filterResults.where, intersectedIds);
    }

    // Skip user scope if:
    // 1. User has explicit assignment filter (checked by shouldSkipUserScope)
    // 2. OR there's already a LoanAssignment filter in WHERE (from applyUserAssignmentFilter)
    const skipUserScope = shouldSkipUserScope(user, filterResults.filters) || hasLoanAssignmentInWhere(filterResults.where);
    // Fetch loans
    const includeConfig = getLoanIncludeConfig();
    const loanQuery = buildLoanQuery(filterResults.where, paginationParams, includeConfig);

    if (skipUserScope) {
      loanQuery._skipUserScope = true;
    }

    const [loans, totalCount] = await Promise.all([
      this.permissionsHelper.loan.findMany(loanQuery),
      this.permissionsHelper.loan.count({ where: filterResults.where, _skipUserScope: skipUserScope }),
    ]);

    // Batch load latest records for all loans (7 queries instead of N×6)
    if (loans.length > 0) {
      const loanIds = loans.map(loan => loan.id);
      const latestRecords = await batchLoadLatestRecords(this.prisma, loanIds);
      attachLatestRecordsToLoans(loans, latestRecords);
    }

    // Enrich loans with actDays
    const enrichedLoans = loans.map(loan => ({
      ...loan,
      actDays: loan.lastActivite ? daysFromDate(loan.lastActivite) : null
    }));

    // Handle CSV export
    if (columns) {
      return this.paginationService.getAllWithoutPagination(enrichedLoans, totalCount);
    }

    // Enrich closed loans with additional data
    if (filterDto.showOnlyClosedLoans) {
      await batchCalculateWriteoffs(enrichedLoans, this.paymentsHelper);
    }

    return this.paginationService.createPaginatedResult(enrichedLoans, totalCount, { page, limit });
  }

  async getSummary(filterDto: GetLoansFilterDto, user: any) {
    // Build where clause using same logic as getAll
    const { where, skipUserScope } = await this.buildLoansWhereClause(filterDto, user);

    // Handle empty results
    if (where.id === -1) {
      return {
        GEL: { title: 'GEL', cases: 0, principal: 0, debt: 0 },
        USD: { title: 'USD', cases: 0, principal: 0, debt: 0 },
        EUR: { title: 'EUR', cases: 0, principal: 0, debt: 0 },
      };
    }

    // Calculate summary statistics (respects filters)
    return await calculateLoanSummaryNew(this.permissionsHelper, where, skipUserScope);
  }

  private async getTeamMemberIds(user: any): Promise<number[] | undefined> {
    // Regional managers get all members from all their managed region teams
    if (isRegionalManager(user)) {
      const regionalTeamIds = getRegionalTeamIds(user);
      if (regionalTeamIds.length > 0) {
        const teamMembers = await this.prisma.teamMembership.findMany({
          where: {
            teamId: { in: regionalTeamIds },
            deletedAt: null,
          },
          select: {
            userId: true,
          },
        });
        return teamMembers.map(tm => tm.userId);
      }
    }

    // Team leads get members from their team
    if (isTeamLead(user)) {
      const activeTeamMembership = user.team_membership?.find(tm => tm.deletedAt === null);
      if (activeTeamMembership) {
        const teamMembers = await this.prisma.teamMembership.findMany({
          where: {
            teamId: activeTeamMembership.teamId,
            deletedAt: null,
          },
          select: {
            userId: true,
          },
        });
        return teamMembers.map(tm => tm.userId);
      }
    }
    return undefined;
  }

  private async buildLoansWhereClause(
    filterDto: GetLoansFilterDto | GetLoansFilterWithPaginationDto,
    user: any
  ): Promise<{ where: any; skipUserScope: boolean }> {
    const { showClosedLoans, showOnlyClosedLoans, ...filters } = filterDto;

    // Build base query
    const where = buildInitialWhereClause();

    // Apply appropriate filters
    if (showOnlyClosedLoans) {
      applyClosedLoansFilter(where, filters);
      applyClosedDateRangeFilter(where, filters);
    } else {
      applyOpenLoansFilter(where, filters, showClosedLoans);
    }

    applyCommonFilters(where, filters);

    // Get team member IDs if user is a collector team lead
    // let teamMemberIds: number[] | undefined;
    // if (user.role_name === Role.COLLECTOR) {
    //   // Regional managers get all members from all their managed region teams
    //   if (isRegionalManager(user)) {
    //     const regionalTeamIds = getRegionalTeamIds(user);
    //     if (regionalTeamIds.length > 0) {
    //       const teamMembers = await this.prisma.teamMembership.findMany({
    //         where: {
    //           teamId: { in: regionalTeamIds },
    //           deletedAt: null,
    //         },
    //         select: {
    //           userId: true,
    //         },
    //       });
    //       teamMemberIds = teamMembers.map(tm => tm.userId);
    //     }
    //   }
    //   // Team leads get members from their team
    //   else if (isTeamLead(user)) {
    //     const activeTeamMembership = user.team_membership?.find(tm => tm.deletedAt === null);
    //     if (activeTeamMembership) {
    //       const teamMembers = await this.prisma.teamMembership.findMany({
    //         where: {
    //           teamId: activeTeamMembership.teamId,
    //           deletedAt: null,
    //         },
    //         select: {
    //           userId: true,
    //         },
    //       });
    //       teamMemberIds = teamMembers.map(tm => tm.userId);
    //     }
    //   }
    // }

    // Get team member IDs (uses same logic as getAll)
    const teamMemberIds = await this.getTeamMemberIds(user);

    applyUserAssignmentFilter(where, filters, user, teamMemberIds);

    // Handle complex filters with intersection
    const relatedFilterIds = await fetchLatestRecordFilterIds(this.prisma, filters);

    // Only process intersection if there are complex filters
    if (shouldProcessIntersection(relatedFilterIds)) {
      // If any filter returned empty results
      if (hasEmptyFilterResults(relatedFilterIds)) {
        return { where: { id: -1 }, skipUserScope: false };
      }

      // Calculate intersection
      const intersectedIds = calculateLoanIdIntersection(relatedFilterIds);

      // If no loans match all filters
      if (intersectedIds.length === 0) {
        return { where: { id: -1 }, skipUserScope: false };
      }

      // Skip user scope if:
      // 1. User has explicit assignment filter (checked by shouldSkipUserScope)
      // 2. OR there's already a LoanAssignment filter in WHERE (from applyUserAssignmentFilter)
      // const skipUserScope = shouldSkipUserScope(user, filters) || hasLoanAssignmentInWhere(where);
      // const skipUserScope = hasLoanAssignmentInWhere(where);
      // Apply intersection to where clause
      applyIntersectedIds(where, intersectedIds);
    }

    // Skip user scope if:
    // 1. User has explicit assignment filter (checked by shouldSkipUserScope)
    // 2. OR there's already a LoanAssignment filter in WHERE (from applyUserAssignmentFilter)
    // This matches the logic in getAll method to ensure consistency
    const skipUserScope = shouldSkipUserScope(user, filters) || hasLoanAssignmentInWhere(where);

    return { where, skipUserScope };
  }

  async getOne(publicId: ParseUUIDPipe, user: any) {
    // Team leads should be able to view team members' loans
    const teamLead = isTeamLead(user);
    const regionalManager = isRegionalManager(user);
    const isLawyer = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'].includes(user.role_name);
    const isCollector = user.role_name === 'collector';

    // Allow team access for team leads viewing individual loans
    const allowTeamAccess = teamLead && (isLawyer || isCollector);

    // Regional managers see loans from all teams under their managed regions
    const allowRegionalAccess = regionalManager && (isLawyer || isCollector);
    const regionalTeamIds = allowRegionalAccess ? getRegionalTeamIds(user) : [];

    // Build comments WHERE clause based on user role and assignment
    const commentsWhere = await buildCommentsWhereClause(this.prisma, user, String(publicId));

    const loan = await this.permissionsHelper.loan.findFirst({
      where: {
        publicId: String(publicId),
        deletedAt: null
      },
      _allowTeamAccess: allowTeamAccess,
      ...(allowRegionalAccess && regionalTeamIds.length > 0 ? { _allowRegionalAccess: true, _regionalTeamIds: regionalTeamIds } : {}),
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
                ContactType: { select: { id: true, name: true } },
                ContactLabel: { select: { name: true } },
              },
              orderBy: { labelId: 'asc' }
            },
            DebtorRealEstate: true,
            DebtorGuarantors: true,
            DebtorEnforcementRecords: true,
            _count: {
              select: { Loan: true }  // This counts all loans for this debtor
            }
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
          orderBy: { createdAt: 'desc' },
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
          where: commentsWhere,
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
            taskStatusId: true,
            createdAt: true,
            User_Tasks_fromUserToUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            TaskStatus: {
              select: {
                title: true,
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
        Transaction: {
          where: { deleted: 0 },
        },
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
        },
        Charges: {
          where: { deletedAt: null },
          include: {
            ChargeType: { select: { title: true } },
            TransactionChannels: { select: { name: true } },
          },
        },
        Reminders: {
          select: {
            id: true,
            type: true,
            comment: true,
            status: true,
            deadline: true,
            createdAt: true,
            User_Reminders_toUserIdToUser: { select: { id: true, firstName: true, lastName: true } },
          },
          where: { deletedAt: null, status: true },
          orderBy: { deadline: 'desc' }
        },
        LoanAssignmentHistory: {
          where: { deletedAt: null },
          select: {
            createdAt: true,
            User_LoanAssignmentHistory_userIdToUser: { select: { id: true, firstName: true, lastName: true } },
            User_LoanAssignmentHistory_createdByToUser: { select: { id: true, firstName: true, lastName: true } },
            Role: { select: { name: true } },
            action: true,
            comment: true,
          }
        },
        PastPayments: true,
        CallHistory: true,
        LawyerRequest: true,
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

    // if (LAWYER_ROLES.includes(user.role_name)) {
    lawyerComments = comments.filter(
      c => LAWYER_ROLES.includes(c.User.Role.name)
    );
    comments = comments.filter(
      c => !LAWYER_ROLES.includes(c.User.Role.name)
    );
    // }

    const { Comments, ...loanData } = loan;

    const initialClaimBreakdown = {
      initPrincipal: loan.principal,
      initInterest: loan.interest,
      initPenalty: loan.penalty,
      initOtherFee: loan.otherFee,
      initLegalCharges: loan.legalCharges,
      initDebt: loan.totalDebt,
    };

    const totalPayments = await this.paymentsHelper.getTotalPaymentsByPublicId(loan.id);

    const statusHistory = loan.LoanStatusHistory.map(item => ({
      status: item.LoanStatusNewStatus?.name,
      date: item.createdAt,
      comment: item.notes,
      user: item.User,
    }));

    const assignmentHistory = loan.LoanAssignmentHistory.map(item => ({
      status: 'Change User',
      date: item.createdAt,
      comment: item.comment,
      user: item.User_LoanAssignmentHistory_createdByToUser,
    }));

    const caseHistory = [...statusHistory, ...assignmentHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Get call history from Old_db_clients_call_history based on phone contacts (type=1)
    let oldCallHistory = [];
    if (loan.Debtor?.DebtorContact) {
      // Extract phone numbers from contacts where type=1
      const phoneContacts = loan.Debtor.DebtorContact
        .filter(contact => contact.ContactType?.id === 1)
        .map(contact => contact.value)
        .filter(Boolean);

      // Query call history if we have phone numbers
      if (phoneContacts.length > 0) {
        oldCallHistory = await this.prisma.old_db_clients_call_history.findMany({
          where: {
            Called: { in: phoneContacts }
          },
          orderBy: { CallDate: 'desc' },
          take: 50 // Limit to prevent heavy queries
        });
      }
    }

    return {
      ...loanData,
      comments,
      lawyerComments,
      activeCommitments,
      initialClaimBreakdown,
      totalPayments,
      caseHistory,
      oldCallHistory
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

  async addComment(publicId: ParseUUIDPipe, addCommentDto: AddCommentDto, user: any, file?: Express.Multer.File) {
    // Check if loan exists
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        debtorId: true,
        caseId: true,
        statusId: true,
        LoanAssignment: true,
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    let upload = null;

    if (file) {
      upload = await this.uploadsHelper.uploadFile(file, `loans/${loan.id}/comments`);
    }

    // Get all other loans for this debtor
    const debtorLoans = await this.prisma.loan.findMany({
      where: {
        debtorId: loan.debtorId,
        deletedAt: null,
        id: { not: loan.id }  // Exclude current loan
      },
      select: {
        id: true,
        caseId: true
      }
    });

    const isUserAssigned =
      loan.LoanAssignment?.some(
        assignment => assignment.userId === user.id,
      ) ?? false;

    const shouldUpdateLastActivity =
      loan.statusId !== LoanStatusId.NEW &&
      user.role_name === Role.COLLECTOR &&
      isUserAssigned;

    await this.prisma.$transaction(async (tx) => {
      // Create the comment for the main loan
      await tx.comments.create({
        data: {
          loanId: loan.id,
          userId: user.id,
          comment: addCommentDto.comment,
          uploadId: upload?.id,
        },
        include: {
          User: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      // Create comments for all related loans with prefix
      if (debtorLoans.length > 0) {
        const relatedComments = debtorLoans.map(relatedLoan => ({
          loanId: relatedLoan.id,
          userId: user.id,
          comment: `From case: ${loan.caseId} ${addCommentDto.comment}`,
          uploadId: upload?.id,
        }));

        await tx.comments.createMany({
          data: relatedComments,
        });
      }

      // Update lastActivite for the main loan
      if (shouldUpdateLastActivity) {
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            actDays: 0,
            lastActivite: new Date(),
          },
        });

        // Update lastActivite for all related loans
        if (debtorLoans.length > 0) {
          await tx.loan.updateMany({
            where: {
              id: { in: debtorLoans.map(l => l.id) },
              deletedAt: null
            },
            data: {
              actDays: 0,
              lastActivite: new Date(),
            }
          });
        }
      }
    });

    return {
      message: 'Comment added successfully',
    };
  }

  async updateComment(commentId: number, updateComment: UpdateCommentDto, userId: number) {
    // Find the comment
    const comment = await this.prisma.comments.findFirst({
      where: {
        id: commentId,
        deletedAt: null
      }
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is the owner of the comment
    if (comment.userId !== userId) {
      throw new BadRequestException('You can only edit your own comments');
    }

    // Check if comment is less than 24 hours old
    const hoursSinceCreation = (Date.now() - comment.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation >= 24) {
      throw new BadRequestException('Comments can only be edited within 24 hours of creation');
    }

    // Update the comment
    await this.prisma.comments.update({
      where: { id: commentId },
      data: {
        comment: updateComment.comment,
        updatedAt: new Date()
      }
    });

    return {
      message: 'Comment updated successfully',
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

  async updateLoanStatus(publicId: ParseUUIDPipe, updateLoanStatusDto: UpdateLoanStatusDto, user: any) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        caseId: true,
        debtorId: true,
        LoanStatus: true,
        LoanAssignment: true,
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

    const minutesAgo = getMinutesAgo(60);
    const myLastComment = await this.prisma.comments.findFirst({
      where: {
        loanId: loan.id,
        deletedAt: null,
        userId: user.id,
        createdAt: { gte: minutesAgo },
      },
    });

    const isUserAssigned =
      loan.LoanAssignment?.some(
        assignment => assignment.userId === user.id,
      ) ?? false;

    const hasRecentComment = !!myLastComment;

    const lastActivity =
      loan.LoanStatus.id === LoanStatusId.NEW &&
      hasRecentComment &&
      user.role_name === Role.COLLECTOR &&
      isUserAssigned;

    // Determine if this status should update all debtor's loans (exclude Promise and Agreement)
    const shouldUpdateAllLoans = ![
      LoanStatusId.PROMISED_TO_PAY,  // 26
      LoanStatusId.AGREEMENT,          // 3
      LoanStatusId.AGREEMENT_CANCELED, // 14
    ].includes(updateLoanStatusDto.statusId);

    // Get all other loans for this debtor
    let debtorLoans: { id: number; statusId: number; publicId: string }[] = [];
    if (shouldUpdateAllLoans) {
      debtorLoans = await this.prisma.loan.findMany({
        where: {
          debtorId: loan.debtorId,
          deletedAt: null,
          id: { not: loan.id }  // Exclude current loan
        },
        select: {
          id: true,
          statusId: true,
          publicId: true
        }
      });
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
      const latestCommittee = await this.prisma.committee.findFirst({
        where: {
          loanId: loan.id,
          type: {
            in: [Committee_type.discount, Committee_type.correction],
          },
          status: Committee_status.complete,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // throw only if NO transactions AND NO committee
      if (transactions.length === 0 && !latestCommittee) {
        throw new BadRequestException(
          'Cannot update loan status without transactions or completed committee',
        );
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
          changedBy: user.id,
          notes: updateLoanStatusDto.comment ?? null,
        },
      });

      if (shouldUpdateAllLoans && debtorLoans.length > 0) {
        // Create history records for all other loans
        const historyRecords = debtorLoans.map(debtorLoan => ({
          loanId: debtorLoan.id,
          oldStatusId: debtorLoan.statusId,
          newStatusId: updateLoanStatusDto.statusId,
          changedBy: user.id,
          notes: `Status changed from Case: ${loan.caseId}${updateLoanStatusDto.comment ? `: ${updateLoanStatusDto.comment}` : ''}`
        }));

        await tx.loanStatusHistory.createMany({
          data: historyRecords,
        });

        // Update all other debtor's loans with the new status and lastActivite
        const updateData: any = {
          statusId: updateLoanStatusDto.statusId,
        };
        if (lastActivity) {
          updateData.lastActivite = new Date();
        }

        await tx.loan.updateMany({
          where: {
            publicId: { in: debtorLoans.map(l => l.publicId) },
            deletedAt: null
          },
          data: updateData
        });
      }

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
            userId: user.id,
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

        await saveScheduleReminders({
          loanId: loan.id,
          commitmentId: commitment.id,
          userId: user.id,
          type: Reminders_type.Agreement,
        }, tx);
      }

      // Handle Promise status
      if (status.name === 'Promised To Pay') {
        await tx.paymentCommitment.updateMany({
          where: { loanId: loan.id, isActive: 1 },
          data: { isActive: 0 },
        });

        const commitment = await this.paymentsHelper.createPaymentCommitment(
          {
            loanId: loan.id,
            amount: updateLoanStatusDto.promise.agreedAmount,
            paymentDate: updateLoanStatusDto.promise.paymentDate,
            comment: updateLoanStatusDto?.comment || null,
            userId: user.id,
            type: 'promise',
          },
          tx
        );

        // Save the schedule
        await this.paymentsHelper.savePaymentSchedule(
          {
            commitmentId: commitment.id,
            schedules: [{
              paymentDate: updateLoanStatusDto.promise.paymentDate,
              amount: updateLoanStatusDto.promise.agreedAmount,
            }],
          },
          tx
        );

        await saveScheduleReminders({
          loanId: loan.id,
          commitmentId: commitment.id,
          userId: user.id,
          type: Reminders_type.Promised_to_pay,
        }, tx);
      }

      if (status.name === 'Agreement Canceled') {
        await tx.paymentCommitment.updateMany({
          where: { loanId: loan.id, isActive: 1 },
          data: { isActive: 0 },
        });

        await tx.reminders.updateMany({
          where: { loanId: loan.id, type: Reminders_type.Agreement, status: true },
          data: { status: false },
        });
      }

      const updateData: any = {
        statusId: updateLoanStatusDto.statusId,
      }
      if (lastActivity) {
        updateData.lastActivite = new Date();
      }
      // Update loan status
      await tx.loan.update({
        where: { publicId: String(publicId) },
        data: updateData,
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
        userId: userId,
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

  async assignLoanToUser(publicId: ParseUUIDPipe, assignLoanDto: AssignLoanDto, user: any) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        statusId: true,
        LoanVisit: {
          orderBy: { createdAt: 'desc' },
          take: 1,
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
      return this.unassign({
        loanId: loan.id,
        roleId: assignLoanDto.roleId,
        assignedBy: user.id,
        hideRequest: assignLoanDto.hideRequest,
        comment: assignLoanDto.comment,
        userId: user.id,
      });
    }

    const assignedUser = await this.prisma.user.findUnique({
      where: { id: assignLoanDto.userId, isActive: true, deletedAt: null },
      // include: {
      //   TeamMembership: {
      //     where: { deletedAt: null, teamRole: TeamMembership_teamRole.leader },
      //   },
      // }
    });
    if (!assignedUser) throw new NotFoundException('User not found');

    //Check role matches
    if (assignedUser.roleId !== assignLoanDto.roleId) {
      throw new BadRequestException('User role does not match roleId provided');
    }

    // if (!user?.team_membership?.some(tm => tm.teamRole === TeamMembership_teamRole.leader)) {
    //   throw new BadRequestException('User is not a team lead');
    // }

    // Check if any visit is pending
    const hasPendingVisit = loan.LoanVisit.some(visit => visit.status === LoanVisit_status.pending);
    if (hasPendingVisit) {
      throw new BadRequestException('Cannot proceed while any visit is still pending');
    }

    const currentAssignment = await getCurrentAssignment(loan.id, assignLoanDto.roleId, this.prisma);


    return await this.prisma.$transaction(async (tx) => {
      // user.id is the new user id
      // userId is the assigned by user id
      await handleCommentsForReassignment(loan.id, assignLoanDto.roleId, user.id, user.id, currentAssignment, tx);

      // Update reminders to new user
      await tx.reminders.updateMany({
        where: { loanId: loan.id, status: true },
        data: { toUserId: assignLoanDto?.userId ?? null },
      });

      return await this.assign({
        loanId: loan.id,
        userId: assignedUser.id,
        roleId: assignLoanDto.roleId,
        assignedBy: user.id,
        comment: assignLoanDto.comment,
        loanStatusId: loan.statusId,
        tx
      });
    });
  }

  private async assign({ loanId, userId, roleId, assignedBy, comment, loanStatusId, tx = null }) {
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
      await this.unassign({ loanId, roleId, assignedBy, comment, userId, tx });
    }

    // Assign new user
    return this.assignNew({ loanId, userId: userId, roleId, assignedBy, comment, loanStatusId, tx });
  }

  private async assignNew({ loanId, userId, roleId, assignedBy, comment, loanStatusId, tx = null }) {
    const dbClient = tx || this.prisma;
    await dbClient.loanAssignment.create({
      data: { loanId, userId, roleId, isActive: true },
    });

    await logAssignmentHistory({ prisma: dbClient, loanId, userId, roleId, action: 'assigned', assignedBy });

    // Get assigned user details for comment
    const assignedUser = await dbClient.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });

    // Create comment for assignment
    if (assignedUser) {
      const commentText = `Assign(${userId}): ${assignedUser.firstName} ${assignedUser.lastName}`;
      await dbClient.comments.create({
        data: {
          loanId: loanId,
          userId: assignedBy,
          comment: commentText
        }
      });
    }

    // Check if this is a lawyer role being assigned
    const role = await dbClient.role.findUnique({
      where: { id: roleId },
      select: { name: true }
    });

    if (role && LAWYER_ROLES.includes(role.name as Role)) {
      // Check if there's a PENDING LawyerRequest for this loan
      const pendingRequest = await dbClient.lawyerRequest.findUnique({
        where: { loanId: loanId }
      });

      if (pendingRequest && pendingRequest.status === 'PENDING') {
        // Update LawyerRequest to ASSIGNED
        await dbClient.lawyerRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: 'ASSIGNED',
            assignedAt: new Date(),
            assignedBy: assignedBy
          }
        });
      }
    }

    if (role && role.name === Role.COLLECTOR) {
      // update loan status to New except if status is Agreement or Agreement Canceled
      const loanStatus = await dbClient.loanStatus.findUnique({
        where: { id: loanStatusId },
        select: { id: true, name: true }
      });

      if (loanStatus && loanStatus.id !== LoanStatusId.AGREEMENT && loanStatus.id !== LoanStatusId.AGREEMENT_CANCELED) {
        await dbClient.loan.update({
          where: { id: loanId },
          data: { statusId: LoanStatusId.NEW, lastActivite: new Date() }
        });
        await dbClient.loanStatusHistory.create({
          data: {
            loanId: loanId,
            oldStatusId: loanStatusId,
            newStatusId: LoanStatusId.NEW,
            changedBy: userId,
            notes: 'Status changed to New because of collector assignment'
          }
        });
      }
    }

    return { loanId, userId, roleId, action: 'assigned' };
  }

  private async unassign({
    loanId,
    roleId,
    assignedBy,
    hideRequest = false,
    comment,
    userId,
    tx = null
  }: {
    loanId: number;
    roleId: number;
    assignedBy: number;
    hideRequest?: boolean;
    comment?: string;
    tx?: any;
    userId?: number;
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

    // Create comment for unassignment if comment provided
    if (comment) {
      const unassigner = await dbClient.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      });

      if (unassigner) {
        const commentText = `${unassigner.firstName} ${unassigner.lastName} Removed Lawyer.Reason: ${comment}`;
        await dbClient.comments.create({
          data: {
            loanId: loanId,
            userId: userId,
            comment: commentText
          }
        });
      }
    }

    // Check if this is a lawyer role being unassigned and hideRequest is true
    if (hideRequest) {
      const role = await dbClient.role.findUnique({
        where: { id: roleId },
        select: { name: true }
      });

      if (role && LAWYER_ROLES.includes(role.name as Role)) {
        // Check if there's a LawyerRequest for this loan
        const lawyerRequest = await dbClient.lawyerRequest.findUnique({
          where: { loanId: loanId }
        });

        if (lawyerRequest) {
          // Update LawyerRequest to HIDDEN
          await dbClient.lawyerRequest.update({
            where: { id: lawyerRequest.id },
            data: {
              status: 'HIDDEN',
              hiddenAt: new Date(),
              hiddenBy: assignedBy
            }
          });
        }
      }
    }
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
        userId: userId,
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
      include: {
        LoanCollateralStatus: true,
      }
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

    // Temporary disabled
    // if (!loan.LoanCollateralStatus.length && legalStage.title === 'Court') {
    //   throw new BadRequestException('Loan must have a collateral status before adding legal stage Court');
    // }

    let comment = data.comment
    if (legalStage.title === 'Execution') {
      comment = `${data.comment} / principal = ${data.principal}, interest = ${data.interest}, other fee = ${data.other}, penalty = ${data.penalty},legal = ${data.legal} /`
    }

    // Create the relationship between loan and legal stage
    await this.prisma.loanLegalStage.create({
      data: {
        loanId: loan.id,
        legalStageId: data.stageId,
        comment: comment,
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

    // Temporary disabled
    // if (!existingCollateralStatus) {
    //   throw new BadRequestException('Loan must have a collateral status before adding litigation stage');
    // }


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

  async downloadSchedulePdfBuffer(publicId: ParseUUIDPipe): Promise<{ buffer: Buffer, caseId: string }> {
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

  async exportLoans(filterDto: GetLoansFilterDto, user: any) {
    // const loans = await this.getAll(filterDto, user);

    // const loanExportData = loans.data.map(loan => prepareLoanExportData(loan));

    // return await generateExcel(loanExportData, filterDto.columns, 'Loans Report');

    const CHUNK_SIZE = 5000;

    // Create async generator for chunked data loading
    const dataGenerator = this.createLoanDataGenerator(filterDto, user, CHUNK_SIZE);

    // Use streaming Excel generation
    return await generateExcelStream(
      dataGenerator,
      filterDto.columns,
      'Loans Report'
    );

  }

  async addLoanReminder(publicId: ParseUUIDPipe, data: AddLoanReminderDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    await this.prisma.reminders.create({
      data: {
        loanId: loan.id,
        type: Reminders_type.Callback,
        comment: data.comment,
        status: true,
        fromUserId: userId,
        toUserId: userId,
        deadline: data.deadLine
      },
    });

    return {
      message: 'Loan reminder added successfully'
    };
  }

  async getAvailableLitigationStatuses(publicId: ParseUUIDPipe) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        LoanLegalStage: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!loan) throw new NotFoundException('Loan not found');

    const where: any = { deletedAt: null };
    // Temporary disabled
    const rules: Record<number, any> = {
      60: { id: { in: [0] } },
      61: { id: { notIn: [6] } },
      62: { id: { in: [6] } },
      64: { id: { in: [8] } },
      65: { id: { in: [5, 8] } },
    };

    if (loan.LoanLegalStage.length > 0) {
      const lastStage = loan.LoanLegalStage[loan.LoanLegalStage.length - 1];
      const stageCode = lastStage.legalStageId;

      if (rules[stageCode]) {
        Object.assign(where, rules[stageCode]);
      }
    }
    return this.prisma.litigationStage.findMany({ where });
  }

  async getAvailableLegalStatuses(publicId: ParseUUIDPipe, user: any) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      select: {
        id: true,
        LoanLegalStage: true,
      },
    });

    if (!loan) throw new NotFoundException('Loan not found');

    const where: any = { deletedAt: null };
    // Temporary disabled
    const rules: Record<number, any> = {
      60: { id: { in: [61, 63, 64] } },
      61: { id: { in: [62] } },
      62: { id: { in: [62] } },
      63: { id: { in: [65] } },
      64: { id: { in: [61, 62] } },
      65: { id: { in: [62] } },
    };

    if (user.id !== 61 && loan.LoanLegalStage.length > 0) {
      const lastStage = loan.LoanLegalStage[loan.LoanLegalStage.length - 1];
      const stageCode = lastStage.legalStageId;

      if (rules[stageCode]) {
        Object.assign(where, rules[stageCode]);
      }
    }

    return await this.prisma.legalStage.findMany({ where });
  }

  async requestLawyer(publicId: ParseUUIDPipe, requestedBy: number) {
    // Find the loan
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      include: {
        LawyerRequest: true
      }
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Check if there's already a request
    const existingRequest = loan.LawyerRequest;

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new BadRequestException('A lawyer request is already pending for this loan');
      }
      if (existingRequest.status === 'HIDDEN') {
        throw new BadRequestException('This loan has been marked as hidden and cannot request a lawyer again');
      }
      // If status is ASSIGNED, allow new request (user can request again)
    }

    // Create new request with PENDING status
    const request = await this.prisma.lawyerRequest.create({
      data: {
        loanId: loan.id,
        requestedBy: requestedBy,
        status: 'PENDING',
        pendingAt: new Date()
      },
      include: {
        User_LawyerRequest_requestedByToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return {
      message: 'Lawyer request submitted successfully',
      request
    };
  }

  async exportPayments(publicId: ParseUUIDPipe, user: any) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      include: {
        Transaction: true,
      },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const columns = [
      'CreatedAt',
      'Date',
      'Payment',
      'Principal',
      'Interest',
      'Penalty',
      'OtherFees',
      'LegalCharges',
      'Currency',
    ];

    const data = loan.Transaction.map(transaction => ({
      CreatedAt: transaction.createdAt?.toISOString().split('T')[0],
      Date: transaction.paymentDate?.toISOString().split('T')[0],
      Payment: transaction.amount || '',
      Principal: transaction.principal || '',
      Interest: transaction.interest || '',
      Penalty: transaction.penalty || '',
      OtherFees: transaction.fees || '',
      LegalCharges: transaction.legal || '',
      Currency: transaction.currency || 'GEL',
    }));

    // Calculate totals
    const totals = data.reduce(
      (acc, row) => ({
        Payment: acc.Payment + Number(row.Payment || 0),
        Principal: acc.Principal + Number(row.Principal || 0),
        Interest: acc.Interest + Number(row.Interest || 0),
        Penalty: acc.Penalty + Number(row.Penalty || 0),
        OtherFees: acc.OtherFees + Number(row.OtherFees || 0),
        LegalCharges: acc.LegalCharges + Number(row.LegalCharges || 0),
      }),
      {
        Payment: 0,
        Principal: 0,
        Interest: 0,
        Penalty: 0,
        OtherFees: 0,
        LegalCharges: 0,
      }
    );

    // Add total row
    data.push({
      CreatedAt: '',
      Date: `Total (${data.length} transactions)`,
      Payment: totals.Payment.toFixed(2),
      Principal: totals.Principal.toFixed(2),
      Interest: totals.Interest.toFixed(2),
      Penalty: totals.Penalty.toFixed(2),
      OtherFees: totals.OtherFees.toFixed(2),
      LegalCharges: totals.LegalCharges.toFixed(2),
      Currency: '',
    });

    return await generateExcel(data, columns, 'Case Payments');
  }

  async exportPreviousPayments(publicId: ParseUUIDPipe, user: any) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId), deletedAt: null },
      include: {
        PastPayments: true,
      },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const columns = [
      'Date',
      'Payment',
      'Principal',
      'Interest',
      'Penalty',
      'OtherFees',
      'Currency',
    ];

    const data = loan.PastPayments.map(payment => ({
      Date: payment.paymentDate?.toISOString().split('T')[0],
      Payment: payment.payment || '',
      Principal: payment.principal || '',
      Interest: payment.interest || '',
      Penalty: payment.penalty || '',
      OtherFees: payment.otherFee || '',
      Currency: payment.currency || 'GEL',
    }));

    // Calculate totals
    const totals = data.reduce(
      (acc, row) => ({
        Payment: acc.Payment + (row.Payment || ''),
        Principal: acc.Principal + (row.Principal || ''),
        Interest: acc.Interest + (row.Interest || ''),
        Penalty: acc.Penalty + (row.Penalty || ''),
        OtherFees: acc.OtherFees + (row.OtherFees || ''),
      }),
      {
        Payment: '',
        Principal: '',
        Interest: '',
        Penalty: '',
        OtherFees: '',
      }
    );

    // Add total row
    data.push({
      Date: `Total (${data.length} payments)`,
      Payment: totals.Payment.toString(),
      Principal: totals.Principal.toString(),
      Interest: totals.Interest.toString(),
      Penalty: totals.Penalty.toString(),
      OtherFees: totals.OtherFees.toString(),
      Currency: '',
    });

    return await generateExcel(data, columns, 'Previous Payments');
  }

  private async *createLoanDataGenerator(
    filterDto: GetLoansFilterDto,
    user: any,
    chunkSize: number
  ): AsyncGenerator<any[], void, unknown> {
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        // Fetch chunk with pagination
        const chunk = await this.getAll(
          {
            ...filterDto,
            page: currentPage,
            limit: chunkSize,
          },
          user
        );

        if (chunk.data.length === 0) {
          hasMore = false;
          break;
        }

        // Transform loans to export format
        const loanExportData = chunk.data.map(loan => prepareLoanExportData(loan));

        yield loanExportData;

        // Check if we have more data
        hasMore = chunk.data.length === chunkSize;
        currentPage++;

      } catch (error) {
        console.error(`Error fetching chunk at page ${currentPage}:`, error);
        throw new Error(`Export failed at page ${currentPage}: ${error.message}`);
      }
    }
  }

  async getAdditionalInfo(userId: number) {
    // Step 1: Fetch guarantors
    const guarantors = await this.prisma.old_db_additional_data.findMany({
      where: {
        // title: { contains: 'guaran' },
      },
      select: {
        case_id: true,
        value: true,
      },
    });

    // const missingCaseIds: number[] = [];

    // Step 2: Track missing case_number / LoanNumber
    // for (const g of guarantors) {
    //   try {
    //     const value = typeof g.value === 'string' ? JSON.parse(g.value) : g.value;

    //     if (!value?.case_number && !value?.LoanNumber) {
    //       missingCaseIds.push(g.case_id);
    //     }
    //   } catch {
    //     missingCaseIds.push(g.case_id);
    //   }
    // }

    // console.log('Missing case_number / LoanNumber:', missingCaseIds);

    // Step 3: Collect caseIds for querying loans
    const caseIds = guarantors
      .map(g => {
        try {
          const value = typeof g.value === 'string' ? JSON.parse(g.value) : g.value;
          return value;
          // const id = value.case_number ?? value.LoanNumber ?? null;
          // return id !== null ? String(id) : null;
        } catch {
          return null;
        }
      })
    // .filter((v): v is string => v != null);
    return caseIds;
    // console.log('Total case numbers:', caseIds.length);

    // Step 4: Fetch loans that match these caseIds
    // const loans = await this.prisma.loan.findMany({
    //   where: {
    //     caseId: { in: caseIds },
    //     deletedAt: null,
    //   },
    //   select: {
    //     caseId: true,
    //     Debtor: { select: { id: true } },
    //   },
    // });

    // Step 5: Build array for insertion into DebtorGuarantors
    // const debtorGuarantorsData = [];
    // Find the first valid guarantor
    // let savedCount = 0;
    // for (const g of guarantors) {
    //   try {
    //     const value = typeof g.value === 'string' ? JSON.parse(g.value) : g.value;
    //     const caseId = value.case_number ?? value.LoanNumber ?? null;

    //     if (!caseId) continue; // skip if no caseId

    //     const loan = loans.find(l => l.caseId === String(caseId));
    //     if (!loan) continue; // skip if no matching loan

    //     // Push data to insert
    //     debtorGuarantorsData.push({
    //       // id: g.case_id,
    //       // caseId: caseId,
    //       debtorId: loan.Debtor.id,
    //       firstName: value.name ?? '',
    //       lastName: value.lastName ?? '.',
    //       phone: value.phone ?? value.Phone ?? null,
    //       mobile: value.mobile ?? value.Mobile ?? null,
    //       address: value.address ?? value.ActAddres ?? null,
    //       idNumber: value.ID_Number ?? value.idnumber ?? null,
    //     });
    //     // savedCount = 1;
    //     // break;
    //   } catch {
    //     continue;
    //   }
    // }

    // console.log('Prepared DebtorGuarantors:', debtorGuarantorsData.length);

    // Step 6: Save into DebtorGuarantors
    // if (debtorGuarantorsData.length > 0) {
    //   await this.prisma.debtorGuarantors.createMany({
    //     data: debtorGuarantorsData,
    //     skipDuplicates: true, // avoid duplicate inserts
    //   });
    // }

    // return debtorGuarantorsData;
  }
}