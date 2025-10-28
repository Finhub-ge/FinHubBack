import { BadRequestException, HttpException, Injectable, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { randomUUID } from "crypto";
import { CreateTaskDto } from "./dto/createTask.dto";
import { Tasks_status, User, Committee_status } from '@prisma/client';
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksFilterDto, GetTasksWithPaginationDto } from "./dto/getTasksFilter.dto";
import { ResponseCommitteeDto } from "./dto/responseCommittee.dto";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { CreateChargeDto } from "./dto/create-charge.dto";
import { S3Helper } from "src/helpers/s3.helper";
import { CreateTeamDto } from "./dto/createTeam.dto";
import { UpdateTeamDto } from "./dto/updateTeam.dto";
import { ManageTeamUsersDto } from "./dto/manageTeamUsers.dto";
import { GetPaymentWithPaginationDto } from "./dto/getPayment.dto";
import { PaginationService } from "src/common/services/pagination.service";
import { GetChargeWithPaginationDto } from "./dto/getCharge.dto";
import { GetMarkReportWithPaginationDto } from "./dto/getMarkReport.dto";
import { GetCommiteesWithPaginationDto } from "./dto/getCommitees.dto";
import { createInitialLoanRemaining, updateLoanRemaining } from "src/helpers/loan.helper";

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper,
    private s3Helper: S3Helper,
    private readonly paginationService: PaginationService,
  ) { }

  async getDebtorContactTypes() {
    return await this.prisma.contactType.findMany();
  }

  async getDebtorContactLabels() {
    return await this.prisma.contactLabel.findMany();
  }

  async getAttributes() {
    return await this.prisma.attributes.findMany()
  }

  async getDebtoreStatuses() {
    return await this.prisma.debtorStatus.findMany()
  }

  async getloanStatuses() {
    return await this.prisma.loanStatus.findMany({
      where: {
        deletedAt: null,
        isActive: true
      }
    })
  }

  async getTasks(user: User, getTasksFilterDto: GetTasksWithPaginationDto) {
    const { page, limit, ...filters } = getTasksFilterDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const conditions = [];

    if (filters.caseId) {
      conditions.push({ Loan: { caseId: filters.caseId } });
    }

    // Created date range
    if (filters.createdDateStart || filters.createdDateEnd) {
      const createdDateCondition: any = {};
      if (filters.createdDateStart) {
        // Set to start of day to include all records from that date
        createdDateCondition.gte = dayjs(filters.createdDateStart).startOf('day').toDate();
      }
      if (filters.createdDateEnd) {
        // Set to end of day to include all records from that date
        createdDateCondition.lte = dayjs(filters.createdDateEnd).endOf('day').toDate();
      }
      conditions.push({ createdAt: createdDateCondition });
    }

    // Deadline range
    if (filters.deadlineDateStart || filters.deadlineDateEnd) {
      const deadlineCondition: any = {};
      if (filters.deadlineDateStart) {
        deadlineCondition.gte = dayjs(filters.deadlineDateStart).startOf('day').toDate();
      }
      if (filters.deadlineDateEnd) {
        deadlineCondition.lte = dayjs(filters.deadlineDateEnd).endOf('day').toDate();
      }
      conditions.push({ deadline: deadlineCondition });
    }

    // Completed date range
    if (filters.completeDateStart || filters.completeDateEnd) {
      const completeDateCondition: any = {};
      if (filters.completeDateStart) {
        completeDateCondition.gte = dayjs(filters.completeDateStart).startOf('day').toDate();
      }
      if (filters.completeDateEnd) {
        completeDateCondition.lte = dayjs(filters.completeDateEnd).endOf('day').toDate();
      }
      conditions.push({ updatedAt: completeDateCondition });
    }
    conditions.push({ deletedAt: null });
    const whereClause = conditions.length > 0 ? { AND: conditions } : {};

    const data = await this.prisma.tasks.findMany({
      where: whereClause,
      ...paginationParams,
      include: {
        User_Tasks_fromUserToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        User_Tasks_toUserIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        Loan: {
          select: {
            caseId: true,
            publicId: true,
          }
        }
      }
    })
    const total = await this.prisma.tasks.count({
      where: whereClause,
    });
    return this.paginationService.createPaginatedResult(data, total, { page, limit });
  }

  async getTransactionList(getPaymentDto: GetPaymentWithPaginationDto) {
    const { page, limit, caseId } = getPaymentDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });
    const data = await this.prisma.transaction.findMany({
      where: {
        deleted: 0,
        ...(caseId && {
          Loan: {
            caseId: caseId
          }
        })
      },
      include: {
        TransactionChannelAccounts: {
          include: {
            TransactionChannels: true
          }
        },
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        Loan: {
          include: {
            Debtor: true
          }
        }
      },
      ...paginationParams,
      orderBy: {
        id: 'desc'
      }
    });
    const total = await this.prisma.transaction.count({
      where: {
        deleted: 0,
        ...(caseId && {
          Loan: {
            caseId: caseId
          }
        })
      }
    });

    const paymentChannels = await this.paymentHelper.gettransactionChannels()
    const dataObj = {
      transactions: data,
      paymentChannels,
    };
    return this.paginationService.createPaginatedResult([dataObj], total, { page, limit });
  }

  async addPayment(data: CreatePaymentDto, userId: number) {
    const loan = await this.prisma.loan.findFirst({
      where: { caseId: Number(data.caseId) },
      include: { LoanStatus: true }
    });

    if (!loan) {
      throw new HttpException('Loan not found', 404);
    }

    let loanRemaining = await this.prisma.loanRemaining.findFirst({
      where: { loanId: loan.id, deletedAt: null }
    });

    if (!loanRemaining) {
      throw new HttpException('Loan remaining balance not found', 404);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (Number(data.amount) > Number(loanRemaining.currentDebt)) {
          const remainingAmount = Number(data.amount) - Number(loanRemaining.currentDebt);
          await tx.loanRemaining.update({
            where: { id: loanRemaining.id },
            data: {
              deletedAt: new Date()
            }
          });
          await tx.loanRemaining.create({
            data: {
              loanId: loan.id,
              principal: loanRemaining.principal,
              interest: loanRemaining.interest,
              penalty: Number(loanRemaining.penalty) + remainingAmount,
              otherFee: loanRemaining.otherFee,
              legalCharges: loanRemaining.legalCharges,
              currentDebt: Number(loanRemaining.currentDebt) + remainingAmount,
              agreementMin: loanRemaining.agreementMin,
            }
          });
          loanRemaining = await tx.loanRemaining.findFirst({
            where: { loanId: loan.id, deletedAt: null }
          });
        }
        const transaction = await tx.transaction.create({
          data: {
            loanId: loan.id,
            amount: Number(data.amount || 0),
            paymentDate: data.paymentDate,
            transactionChannelAccountId: data.accountId,
            publicId: randomUUID(),
            userId: userId,
            principal: 0,
            interest: 0,
            penalty: 0,
            fees: 0,
            legal: 0,
            comment: data.comment || null
          }
        });

        // If LoanRemaining doesn't exist, create it with initial values from Loan implement later
        const allocationResult = await this.paymentHelper.allocatePayment(
          transaction.id,
          Number(data.amount || 0),
          loanRemaining,
          tx
        );

        // return allocationResult
        await this.paymentHelper.updateTransactionSummary(
          transaction.id,
          allocationResult.transactionSummary,
          tx
        );

        await this.paymentHelper.updateLoanRemaining(
          loanRemaining.id,
          allocationResult.newBalances,
          allocationResult.newCurrentDebt,
          loanRemaining,
          tx
        );

        await this.paymentHelper.createBalanceHistory(
          loan.id,
          transaction.id,
          allocationResult.newBalances,
          allocationResult.newCurrentDebt,
          'PAYMENT',
          tx
        );

        if (loan.LoanStatus.name === 'Agreement') {
          await this.paymentHelper.applyPaymentToSchedule(
            loan.id,
            Number(data.amount || 0),
            tx
          );
        }

        // Update loan status if balance is fully paid
        if (Number(allocationResult.newCurrentDebt) === 0) {
          // Update loan status
          await tx.loan.update({
            where: { id: loan.id },
            data: {
              statusId: 12,
              closedAt: new Date(),
            }
          });

          // Create loan status history record
          await tx.loanStatusHistory.create({
            data: {
              loanId: loan.id,
              oldStatusId: loan.statusId,
              newStatusId: 12,
              changedBy: userId,
              notes: 'Automatically updated to Closed (paid) - loan balance reached 0',
            },
          });
        }

        return {
          message: 'Payment added successfully'
        };
      });
    } catch (error) {
      // Transaction automatically rolled back
      console.error('Payment processing failed:', error);
      throw new HttpException(
        'Failed to process payment. Please try again.',
        500
      );
    }
  }

  async updatePayment(publicId: ParseUUIDPipe, data: UpdatePaymentDto) {

    const payment = await this.prisma.transaction.findUnique({
      where: {
        publicId: String(publicId)
      }
    })

    if (!payment) throw new HttpException('Payment not found', 404)

    await this.prisma.transaction.update({
      where: {
        publicId: String(publicId)
      },
      data: {
        amount: Number(data.amount || 0),
        paymentDate: data.paymentDate,
        transactionChannelAccountId: data.accountId
      }
    })

    throw new HttpException('Payment edited successfully', 200);
  }

  async deleteTransaction(id: number) {
    await this.prisma.transaction.delete({
      where: {
        id: id
      }
    })

    throw new HttpException('User deleted successfully', 200);

  }

  async createTask(data: CreateTaskDto, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.toUserId, deletedAt: null }
    });

    if (!user) {
      throw new Error(`User not found: ${data.toUserId}`);
    }

    const newTask = {
      fromUser: userId,
      toUserId: data.toUserId,
      task: data.task,
      deadline: data.deadline,
      status: Tasks_status.pending
    }

    if (data.publicId) {
      const loan = await this.prisma.loan.findUnique({
        where: { publicId: data.publicId, deletedAt: null }
      });

      if (!loan) {
        throw new Error(`Loan not found for publicId: ${data.publicId}`);
      }

      newTask['loanId'] = loan.id;
    }

    await this.prisma.tasks.create({
      data: newTask
    })

    throw new HttpException('Task created successfully', 200);
  }

  async createTaskResponse(taskId: number, data: CreateTaskResponseDto, userId: number) {
    const task = await this.prisma.tasks.findUnique({
      where: {
        id: taskId,
        status: Tasks_status.pending
      },
      include: {
        User_Tasks_toUserIdToUser: true
      }
    })
    if (task.User_Tasks_toUserIdToUser.id !== userId) {
      throw new BadRequestException('Task does not belong to you');
    }

    await this.prisma.tasks.update({
      where: { id: taskId },
      data: {
        response: data.response,
        status: Tasks_status.complete
      }
    })

    throw new HttpException('Task completed successfully', 200);
  }

  async responseCommittee(committeeId: number, data: ResponseCommitteeDto, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const committee = await tx.committee.findUnique({
        where: {
          id: committeeId,
          status: Committee_status.pending
        },
        include: {
          Loan: true
        }
      });

      if (!committee) {
        throw new BadRequestException('Committee request not found or already processed');
      }

      await tx.committee.update({
        where: { id: committeeId },
        data: {
          responseText: data.responseText,
          status: Committee_status.complete,
          type: data.type || committee.type,
          responderId: userId,
          responseDate: new Date(),
          agreementMinAmount: data.agreementMinAmount
        }
      });

      const currentRemaining = await tx.loanRemaining.findFirst({
        where: {
          loanId: committee.loanId,
          deletedAt: null,
        }
      });

      // if (!currentRemaining) {
      //   await createInitialLoanRemaining(tx, committee, data.agreementMinAmount);
      // } else {
      await updateLoanRemaining(tx, currentRemaining, data.agreementMinAmount);
      // }

      return { message: 'Committee response submitted successfully' };
    });
  }

  async getAllCommittees(getCommiteesDto: GetCommiteesWithPaginationDto) {
    const { page, limit, ...filters } = getCommiteesDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const where: any = { deletedAt: null };

    if (filters.caseId) {
      where.Loan = { caseId: filters.caseId };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.createdDateStart || filters.createdDateEnd) {
      const createdDateCondition: any = {};
      if (filters.createdDateStart) {
        createdDateCondition.gte = dayjs(filters.createdDateStart).startOf('day').toDate();
      }
      if (filters.createdDateEnd) {
        createdDateCondition.lte = dayjs(filters.createdDateEnd).endOf('day').toDate();
      }
      where.createdAt = createdDateCondition;
    }

    const data = await this.prisma.committee.findMany({
      where,
      ...paginationParams,
      include: {
        Loan: {
          select: {
            publicId: true,
            caseId: true,
            Debtor: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            LoanRemaining: {
              where: {
                deletedAt: null
              }
            },
            Portfolio: {
              select: {
                portfolioSeller: true
              }
            },
            LoanLegalStage: {
              where: {
                deletedAt: null,
              },
              select: {
                LegalStage: {
                  select: {
                    id: true,
                    title: true
                  }
                }
              }
            },
          }
        },
        User_Committee_requesterIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        User_Committee_responderIdToUser: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        Uploads: {
          select: {
            id: true,
            originalFileName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const total = await this.prisma.committee.count({
      where,
    });
    return this.paginationService.createPaginatedResult(data, total, { page, limit });
  }

  async createMarks(title: string) {
    await this.prisma.marks.create({
      data: { title }
    });
    return {
      message: 'Marks created successfully'
    }
  }

  async updateMarks(id: number, title: string) {
    await this.prisma.marks.update({
      where: { id },
      data: { title }
    });
    return {
      message: 'Marks updated successfully'
    }
  }

  async deleteMarks(id: number) {
    await this.prisma.marks.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
    return {
      message: 'Marks deleted successfully'
    }
  }

  async getMarks() {
    return await this.prisma.marks.findMany({
      where: {
        deletedAt: null
      }
    });
  }

  async getLoanMarks(getMarkReportDto: GetMarkReportWithPaginationDto) {
    const { page, limit, ...filters } = getMarkReportDto;

    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const where: any = { deletedAt: null };
    where.Loan = {};
    where.LoanAssignment = undefined;

    if (filters.caseId) {
      where.Loan.caseId = filters.caseId;
    }
    if (filters.assigneduser?.length) {
      where.Loan.LoanAssignment = {
        some: { User: { id: { in: filters.assigneduser } } },
      };
    }
    if (filters.portfolio?.length) {
      where.Loan.groupId = { in: filters.portfolio };
    }
    if (filters.portfolioseller?.length) {
      where.Loan.Portfolio = {
        portfolioSeller: { id: { in: filters.portfolioseller } },
      };
    }
    if (filters.marks?.length) {
      where.Marks = { id: { in: filters.marks } };
    }

    const data = await this.prisma.loanMarks.findMany({
      where,
      ...paginationParams,
      include: {
        Marks: {
          select: {
            id: true,
            title: true
          }
        },
        Loan: {
          select: {
            publicId: true,
            caseId: true,
            principal: true,
            groupId: true,
            totalDebt: true,
            Debtor: {
              select: {
                firstName: true,
                lastName: true
              }
            },
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
            PortfolioCaseGroup: {
              select: {
                id: true,
                groupName: true,
              }
            },
            LoanAssignment: {
              where: {
                deletedAt: null,
                isActive: true,
                unassignedAt: null
              },
              select: {
                User: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    Role: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    const total = await this.prisma.loanMarks.count({
      where: where,
    });
    return this.paginationService.createPaginatedResult(data, total, { page, limit });
  }

  async getLegalStages() {
    return await this.prisma.legalStage.findMany({
      where: {
        deletedAt: null
      }
    });
  }

  async getCollateralStatuses() {
    return await this.prisma.collateralStatus.findMany({
      where: {
        deletedAt: null
      }
    });
  }

  async getLitigationStages() {
    return await this.prisma.litigationStage.findMany({
      where: {
        deletedAt: null
      }
    });
  }

  async getChargeTypes() {
    return await this.prisma.chargeType.findMany({
      where: {
        deletedAt: null
      }
    });
  }

  async addCharge(data: CreateChargeDto, userId: number) {
    const loan = await this.prisma.loan.findFirst({
      where: { caseId: Number(data.caseId) }
    });

    if (!loan) throw new HttpException('Loan not found', 404)

    const loanRemaining = await this.prisma.loanRemaining.findFirst({
      where: { loanId: loan.id, deletedAt: null }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.charges.create({
        data: {
          loanId: loan.id,
          chargeTypeId: data.chargeTypeId,
          amount: Number(data.amount),
          paymentDate: data.chargeDate,
          comment: data.comment,
          currency: loan.currency,
          transactionChannelAccountId: data.accountId,
          userId: userId,
          channelId: data.channel,
        }
      });

      await tx.loanRemaining.update({
        where: { id: loanRemaining.id },
        data: {
          deletedAt: new Date()
        }
      });
      await tx.loanRemaining.create({
        data: {
          loanId: loan.id,
          principal: loanRemaining.principal,
          interest: loanRemaining.interest,
          penalty: loanRemaining.penalty,
          otherFee: loanRemaining.otherFee,
          legalCharges: Number(loanRemaining.legalCharges) + Number(data.amount),
          currentDebt: Number(loanRemaining.currentDebt) + Number(data.amount),
          agreementMin: Number(loanRemaining.agreementMin) + Number(data.amount),
        }
      });
    });

    return {
      message: 'Charge added successfully'
    }
  }

  async getCharges(getChargeDto: GetChargeWithPaginationDto) {
    const { page, limit, caseId } = getChargeDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });
    const data = await this.prisma.charges.findMany({
      where: {
        deletedAt: null,
        ...(caseId && {
          Loan: {
            caseId: caseId
          }
        })
      },
      include: {
        Loan: {
          select: {
            caseId: true,
            Debtor: {
              select: {
                firstName: true,
                lastName: true,
                idNumber: true
              }
            },
            LoanAssignment: {
              select: {
                User: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        ChargeType: {
          select: {
            title: true
          }
        },
        User: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        TransactionChannelAccounts: {
          select: {
            TransactionChannels: {
              select: {
                name: true
              }
            }
          }
        }
      },
      ...paginationParams,
      orderBy: {
        createdAt: 'desc'
      }
    })
    const total = await this.prisma.charges.count({
      where: {
        deletedAt: null,
        ...(caseId && {
          Loan: {
            caseId: caseId
          }
        })
      }
    });
    return this.paginationService.createPaginatedResult(data, total, { page, limit });
  }

  async getPortfolios() {
    return await this.prisma.portfolioCaseGroup.findMany({
      where: { deletedAt: null }
    });
  }

  async getPortfolioSellers() {
    return await this.prisma.portfolioSeller.findMany({
      where: { deletedAt: null, active: '1' }
    });
  }

  async downloadFile(uploadId: number, expiresInSeconds = 3600) {
    // 1. Fetch upload info from DB
    const upload = await this.prisma.uploads.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new HttpException('File not found', 404);
    }

    // 2. Generate signed URL via S3Helper
    const signedUrl = await this.s3Helper.getSignedUrl(upload.filePath, expiresInSeconds);

    return signedUrl;
  }

  async createTeam(data: CreateTeamDto) {
    await this.prisma.team.create({
      data: data
    });
    return {
      message: 'Team created successfully'
    }
  }

  async getTeams() {
    return await this.prisma.team.findMany({
      where: { deletedAt: null }
    });
  }

  async updateTeam(teamId: number, data: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team || team.deletedAt !== null) {
      throw new BadRequestException('Team not found');
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data: data
    });

    return {
      message: 'Team updated successfully'
    }
  }

  async deleteTeam(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team || team.deletedAt !== null) {
      throw new BadRequestException('Team not found');
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data: {
        deletedAt: new Date()
      }
    });

    return {
      message: 'Team deleted successfully'
    }
  }

  async manageTeamUsers(teamId: number, data: ManageTeamUsersDto) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team || team.deletedAt !== null) {
      throw new BadRequestException('Team not found');
    }

    // Check if all users exist and are active
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: data.userIds },
        isActive: true,
        deletedAt: null
      }
    });

    if (users.length !== data.userIds.length) {
      throw new BadRequestException('One or more users not found or inactive');
    }

    if (data.team_role === null) {
      // Unassign users from team
      const result = await this.prisma.teamMembership.updateMany({
        where: {
          userId: { in: data.userIds },
          teamId: teamId,
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      return {
        message: `Successfully unassigned ${result.count} users from team`
      };
    } else {
      // Assign users to team
      // Remove existing team memberships for these users
      await this.prisma.teamMembership.updateMany({
        where: {
          userId: { in: data.userIds },
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      // Create new team memberships
      const memberships = data.userIds.map(userId => ({
        userId,
        teamId,
        teamRole: data.team_role
      }));

      await this.prisma.teamMembership.createMany({
        data: memberships
      });

      return {
        message: `Successfully assigned ${data.userIds.length} users to team`
      };
    }
  }

  async getCity() {
    return await this.prisma.city.findMany({
      where: { deletedAt: null }
    });
  }
}