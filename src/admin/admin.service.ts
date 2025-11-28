import { BadRequestException, HttpException, Injectable, NotFoundException, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { randomUUID } from "crypto";
import { CreateTaskDto } from "./dto/createTask.dto";
import { User, Committee_status, StatusMatrix_entityType, CollectorMonthlyReport_status } from '@prisma/client';
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksFilterDto, GetTasksWithPaginationDto, TaskType } from "./dto/getTasksFilter.dto";
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
import { GetPaymentReportWithPaginationDto } from "./dto/getPaymentReport.dto";
import { GetChargeReportWithPaginationDto } from "./dto/getChargeReport.dto";
import { addDays } from "src/helpers/date.helper";
import { Role } from "src/enums/role.enum";
import { GetFuturePaymentsWithPaginationDto } from "./dto/getFuturePayments.dto";
import { UploadPlanDto } from "src/admin/dto/uploadPlan.dto";
import { parseExcelBuffer } from "src/helpers/excel.helper";
import { normalizeName } from "src/helpers/accountId.helper";
import { calculateCollectorLoanStats, executeBatchOperations, fetchExistingReports, loanAssignments, prepareDataForInsert, separateCreatesAndUpdates, updateCollectedAmount } from "src/helpers/reports.helper";

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

    if (filters.type === TaskType.ASSIGNED_TO_ME) {
      conditions.push({ toUserId: Number(user.id) });
    }

    if (filters.type === TaskType.ASSIGNED_BY_ME) {
      conditions.push({ fromUser: Number(user.id) });
    }

    if (filters.employeeId) {
      conditions.push({ toUserId: Number(filters.employeeId) });
    }

    if (filters.statusId) {
      conditions.push({ taskStatusId: filters.statusId });
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
        TaskStatus: {
          select: {
            title: true,
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

  async getTransactionList(getPaymentDto: GetPaymentWithPaginationDto | GetPaymentReportWithPaginationDto, options?: { isReport?: boolean }) {
    const { page, limit, caseId } = getPaymentDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const includes = {
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
    };
    if (options?.isReport) {
      Object.assign(includes.Loan.include, {
        PortfolioCaseGroup: {
          select: {
            groupName: true,
          },
        },
        Portfolio: {
          select: {
            portfolioSeller: true,
          },
        },
        LoanAssignment: {
          where: { isActive: true },
          select: {
            createdAt: true,
            User: { select: { id: true, firstName: true, lastName: true } },
            Role: { select: { name: true } },
          },
        },
      });
    }

    const where: any = {
      deleted: 0,
    };

    const loanFilter: any = {};
    if (caseId) loanFilter.caseId = caseId;

    if (options?.isReport) {
      const filters = getPaymentDto as GetPaymentReportWithPaginationDto;
      if (filters.portfolioId?.length) {
        loanFilter.groupId = { in: filters.portfolioId };
      }
      if (filters.portfolioseller?.length) {
        loanFilter.Portfolio = { portfolioSeller: { id: { in: filters.portfolioseller } } };
      }
      if (filters.assignedCollector?.length) {
        loanFilter.LoanAssignment = {
          some: {
            userId: { in: filters.assignedCollector },
          },
        };
      }
      if (filters.paymentDateStart || filters.paymentDateEnd) {
        where.paymentDate = {
          ...(filters.paymentDateStart
            ? { gte: dayjs(filters.paymentDateStart).startOf('day').toDate() }
            : {}),
          ...(filters.paymentDateEnd
            ? { lte: dayjs(filters.paymentDateEnd).endOf('day').toDate() }
            : {}),
        };
      }
      if (filters.accountNumber?.length) {
        where.transactionChannelAccountId = { in: filters.accountNumber };
      }
      if (filters.currency) {
        where.currency = filters.currency;
      }
    }

    if (Object.keys(loanFilter).length) {
      where.Loan = { is: loanFilter };
    }

    const data = await this.prisma.transaction.findMany({
      where,
      include: includes,
      ...paginationParams,
      orderBy: { id: 'desc' },
    });

    const total = await this.prisma.transaction.count({
      where,
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
      where: { caseId: String(data.caseId) },
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
      const result = await this.prisma.$transaction(async (tx) => {
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
          'PAYMENT',
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
            data.paymentDate,
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

        await updateCollectedAmount(loan.id, Number(transaction.amount || 0), tx);

        return {
          loanId: loan.id,
          transactionId: transaction.id,
          allocationResult
        }
      });

      this.paymentHelper.applyPaymentToCharges(result)
        .catch((error) => console.error('Error applying payment to charges:', error));

      await this.paymentHelper.saveTransactionAssignments(result.transactionId)
        .catch((error) => console.error('Error saving transaction assignments:', error));

      return {
        message: 'Payment added successfully'
      };
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
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const tasksCreatedToday = await this.prisma.tasks.count({
      where: {
        fromUser: userId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        },
        deletedAt: null
      }
    });

    if (tasksCreatedToday >= 5) {
      throw new BadRequestException('You have reached the daily limit of 5 tasks');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.toUserId, deletedAt: null },
      include: { Role: true }
    });

    if (!user) {
      throw new Error(`User not found: ${data.toUserId}`);
    }

    const deadline = user.Role.name === Role.JUNIOR_LAWYER ? addDays(new Date(), 5) : data.deadline ? data.deadline : new Date();

    const newTask = {
      fromUser: userId,
      toUserId: data.toUserId,
      task: data.task,
      deadline: deadline,
      taskStatusId: 1
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
        id: taskId
      },
      include: {
        User_Tasks_toUserIdToUser: true,
        TaskStatus: true
      }
    })

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.User_Tasks_toUserIdToUser.id !== userId) {
      throw new BadRequestException('Task does not belong to you');
    }

    const fiveDaysLater = addDays(new Date(), 5);

    const taskStatus = await this.prisma.taskStatus.findUnique({
      where: { id: data.taskStatusId }
    });

    if (taskStatus.title === 'Postpone' && data.deadline && dayjs(data.deadline).isAfter(fiveDaysLater)) {
      throw new BadRequestException('Deadline is too far in the future, it must be within 5 days');
    }

    const isTransitionAllowed = await this.prisma.statusMatrix.findFirst({
      where: {
        entityType: 'TASK',
        fromStatusId: task.taskStatusId,
        toStatusId: data.taskStatusId,
        isAllowed: true,
        deletedAt: null,
      },
    });

    if (!isTransitionAllowed) {
      throw new BadRequestException(`Status transition from ${task.TaskStatus.title} status to ${taskStatus.title} is not allowed`);
    }

    await this.prisma.tasks.update({
      where: { id: taskId },
      data: {
        response: data.response,
        taskStatusId: data.taskStatusId
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

    if (filters.search) {
      where.Loan = { caseId: filters.search };
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
    const { page, limit, skip, ...filters } = getMarkReportDto;

    const paginationParams = this.paginationService.getPaginationParams({ page, limit, skip });

    const where: any = { deletedAt: null };
    where.Loan = { deletedAt: null };
    where.LoanAssignment = undefined;

    if (filters.search) {
      const searchTerm = filters.search;

      where.OR = [
        { Loan: { caseId: Number(searchTerm) } },
        {
          Loan: {
            LoanAssignment: {
              some: {
                User: {
                  OR: [
                    { firstName: { contains: searchTerm } },
                    { lastName: { contains: searchTerm } },
                  ],
                },
              },
            },
          },
        },
        {
          Loan: {
            Debtor: {
              OR: [
                { firstName: { contains: searchTerm } },
                { lastName: { contains: searchTerm } },
              ],
            },
          },
        },
        {
          Marks: {
            title: { contains: searchTerm },
          },
        },
      ];
    }

    if (filters.assignedCollector?.length) {
      where.Loan.LoanAssignment = {
        some: { User: { id: { in: filters.assignedCollector }, isActive: true } },
      };
    }
    if (filters.assignedLawyer?.length) {
      where.Loan.LoanAssignment = {
        some: { User: { id: { in: filters.assignedLawyer }, isActive: true } },
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
    return this.paginationService.createPaginatedResult(data, total, { page, limit, skip });
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
      where: { caseId: String(data.caseId) }
    });

    if (!loan) throw new HttpException('Loan not found', 404)

    const chargeType = await this.prisma.chargeType.findUnique({
      where: { id: data.chargeTypeId }
    });

    if (!chargeType) throw new HttpException('Charge type not found', 404)

    const loanRemaining = await this.prisma.loanRemaining.findFirst({
      where: { loanId: loan.id, deletedAt: null }
    });

    await this.prisma.$transaction(async (tx) => {
      const charge = await tx.charges.create({
        data: {
          loanId: loan.id,
          chargeTypeId: data.chargeTypeId,
          amount: Number(data.amount),
          comment: data.comment,
          currency: loan.currency,
          transactionChannelAccountId: data.accountId,
          userId: userId,
          channelId: data.channel,
          chargeDate: data.chargeDate,
        }
      });

      await tx.loanRemaining.update({
        where: { id: loanRemaining.id },
        data: {
          deletedAt: new Date()
        }
      });

      // Determine which field to update
      const isLegalCharge = ['Court', 'Execution'].includes(chargeType.title);
      const isOtherFee = ['Other', 'Post', 'Registry'].includes(chargeType.title);

      // Compute new balances
      const newLoanRemainingData: any = {
        loanId: loan.id,
        principal: loanRemaining.principal,
        interest: loanRemaining.interest,
        penalty: loanRemaining.penalty,
        otherFee: loanRemaining.otherFee,
        legalCharges: loanRemaining.legalCharges,
        currentDebt: loanRemaining.currentDebt,
        agreementMin: loanRemaining.agreementMin,
      };

      if (isLegalCharge) {
        newLoanRemainingData.legalCharges = Number(loanRemaining.legalCharges) + Number(data.amount);
      }

      if (isOtherFee) {
        newLoanRemainingData.otherFee = Number(loanRemaining.otherFee) + Number(data.amount);
      }

      newLoanRemainingData.currentDebt = Number(loanRemaining.currentDebt) + Number(data.amount);
      newLoanRemainingData.agreementMin = Number(loanRemaining.agreementMin) + Number(data.amount);

      const newLoanRemaining = await tx.loanRemaining.create({
        data: newLoanRemainingData,
      });

      // Determine allocation type
      const componentType = isLegalCharge ? 'LEGAL_CHARGES' : 'OTHER_FEE';
      const sourceType = isLegalCharge ? 'LEGAL_CHARGES_ADDED' : 'OTHER_FEE_ADDED';

      await tx.paymentAllocationDetail.create({
        data: {
          loanId: loan.id,
          sourceType: sourceType,
          sourceId: charge.id,
          componentType: componentType,
          amountAllocated: Number(data.amount || 0),
          balanceBefore: isLegalCharge
            ? Number(loanRemaining.legalCharges)
            : Number(loanRemaining.otherFee),
          balanceAfter: isLegalCharge
            ? Number(newLoanRemaining.legalCharges)
            : Number(newLoanRemaining.otherFee),
          allocationOrder: 1,
        }
      });

      await tx.loanBalanceHistory.create({
        data: {
          loanId: loan.id,
          principal: newLoanRemaining.principal,
          interest: newLoanRemaining.interest,
          penalty: newLoanRemaining.penalty,
          otherFee: newLoanRemaining.otherFee,
          legalCharges: newLoanRemaining.legalCharges,
          totalDebt: newLoanRemaining.currentDebt,
          sourceType: sourceType,
          sourceId: charge.id,
        }
      });
    });

    return {
      message: 'Charge added successfully'
    }
  }

  async getCharges(getChargeDto: GetChargeWithPaginationDto | GetChargeReportWithPaginationDto, options?: { isReport?: boolean }) {
    const { page, limit, search } = getChargeDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const includes = {
      Loan: {
        select: {
          caseId: true,
          publicId: true,
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
                  id: true,
                  firstName: true,
                  lastName: true
                }
              },
              Role: {
                select: {
                  name: true
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
    }
    if (options?.isReport) {
      Object.assign(includes.Loan.select, {
        Portfolio: {
          select: {
            portfolioSeller: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      });
    }
    const where: any = {
      deletedAt: null,
    };

    const loanFilter: any = {};
    if (search) {
      const searchTerm = search;

      where.OR = [
        { Loan: { caseId: Number(searchTerm) } },
        {
          Loan: {
            LoanAssignment: {
              some: {
                User: {
                  OR: [
                    { firstName: { contains: searchTerm } },
                    { lastName: { contains: searchTerm } },
                  ],
                },
              },
            },
          },
        },
        {
          Loan: {
            Debtor: {
              OR: [
                { firstName: { contains: searchTerm } },
                { lastName: { contains: searchTerm } },
              ],
            },
          },
        },
        {
          ChargeType: {
            title: { contains: searchTerm },
          },
        },
      ];
    }

    if (options?.isReport) {
      const filters = getChargeDto as GetChargeReportWithPaginationDto;

      if (filters.chargeDateStart || filters.chargeDateEnd) {
        where.paymentDate = {
          ...(filters.chargeDateStart
            ? { gte: dayjs(filters.chargeDateStart).startOf('day').toDate() }
            : {}),
          ...(filters.chargeDateEnd
            ? { lte: dayjs(filters.chargeDateEnd).endOf('day').toDate() }
            : {}),
        };
      }

      const assignments: any[] = [];
      if (filters.assignedCollector?.length) {
        assignments.push({ userId: { in: filters.assignedCollector } });
      }
      if (filters.assignedLawyer?.length) {
        assignments.push({ userId: { in: filters.assignedLawyer } });
      }
      if (assignments.length) {
        loanFilter.LoanAssignment = { some: { OR: assignments } };
      }
    }

    if (Object.keys(loanFilter).length) {
      where.Loan = { is: loanFilter };
    }

    const data = await this.prisma.charges.findMany({
      where,
      include: includes,
      ...paginationParams,
      orderBy: { id: 'desc' },
    })
    const total = await this.prisma.charges.count({
      where
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

  async getVisitStatus() {
    return await this.prisma.visitStatus.findMany({
      where: { deletedAt: null }
    });
  }

  async getChannelAccounts() {
    return await this.prisma.transactionChannelAccounts.findMany({
      where: { active: 1 }
    });
  }

  async getTaskStatuses() {
    return await this.prisma.taskStatus.findMany({
      where: { deletedAt: null }
    });
  }

  async getAvailableTaskStatuses(taskId: number, entityType: StatusMatrix_entityType) {
    let currentStatusId: number;

    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        TaskStatus: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    currentStatusId = task.TaskStatus.id;

    // Get allowed transitions from StatusMatrix
    const allowedStatuses = await this.prisma.statusMatrix.findMany({
      where: {
        entityType,
        fromStatusId: currentStatusId,
        isAllowed: true,
        deletedAt: null,
      },
    });

    const toStatusIds = allowedStatuses.map(t => t.toStatusId);
    const statusDetails = await this.prisma.taskStatus.findMany({
      where: { id: { in: toStatusIds } },
    });
    // return statusDetails;
    return {
      allowedStatuses: allowedStatuses.map(transition => {
        const status = statusDetails.find(s => s.id === transition.toStatusId);
        return {
          statusId: transition.toStatusId,
          status: status?.title,
          requiresReason: transition.requiresReason === true,
          description: transition.description,
        };
      }),
    };
  }

  async getFuturePayments(getFuturePaymentsDto: GetFuturePaymentsWithPaginationDto) {
    const { page, limit, search, skip } = getFuturePaymentsDto;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit });

    const where: any = {
      deletedAt: null,
      isActive: 1,
      PaymentSchedule: {
        some: {
          paymentDate: {
            gte: dayjs().startOf('day').toDate()
          }
        }
      }
    };

    let schedulePaymentDateFilter: any = {
      gte: dayjs().startOf('day').toDate()
    };

    if (search) {
      where.Loan = { caseId: search };
    }

    if (getFuturePaymentsDto.type) {
      where.type = getFuturePaymentsDto.type;
    }

    if (getFuturePaymentsDto.assignedCollector?.length) {
      where.Loan = {
        ...where.Loan,
        LoanAssignment: { some: { User: { id: { in: getFuturePaymentsDto.assignedCollector } } } }
      };
    }

    if (getFuturePaymentsDto.portfolioCaseGroup?.length) {
      where.Loan = {
        ...where.Loan,
        PortfolioCaseGroup: { id: { in: getFuturePaymentsDto.portfolioCaseGroup } }
      };
    }

    const portfolioFilter: any = {};
    if (getFuturePaymentsDto.portfolioseller?.length) {
      portfolioFilter.portfolioSeller = { id: { in: getFuturePaymentsDto.portfolioseller } };
    }
    if (Object.keys(portfolioFilter).length > 0) {
      where.Loan = {
        ...where.Loan,
        Portfolio: portfolioFilter
      };
    }

    if (getFuturePaymentsDto.paymentDateStart || getFuturePaymentsDto.paymentDateEnd) {
      schedulePaymentDateFilter = {
        ...(getFuturePaymentsDto.paymentDateStart
          ? { gte: dayjs(getFuturePaymentsDto.paymentDateStart).startOf('day').toDate() }
          : { gte: dayjs().startOf('day').toDate() }),
        ...(getFuturePaymentsDto.paymentDateEnd
          ? { lte: dayjs(getFuturePaymentsDto.paymentDateEnd).endOf('day').toDate() }
          : {}),
      };

      where.PaymentSchedule.some.paymentDate = schedulePaymentDateFilter;
    }

    const data = await this.prisma.paymentCommitment.findMany({
      where,
      select: {
        id: true,
        type: true,
        Loan: {
          select: {
            id: true,
            publicId: true,
            caseId: true,
            currency: true,
            LoanAssignment: {
              select: {
                User: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    Role: {
                      select: {
                        name: true,
                      }
                    }
                  }
                }
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
            Debtor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                idNumber: true,
              }
            },
            PortfolioCaseGroup: {
              select: {
                id: true,
                groupName: true,
              }
            },
          }
        },
        PaymentSchedule: {
          where: {
            paymentDate: schedulePaymentDateFilter
          },
          select: {
            id: true,
            paymentDate: true,
            amount: true,
          }
        }
      },
      ...paginationParams,
    });

    const total = await this.prisma.paymentCommitment.count({
      where,
    });

    return this.paginationService.createPaginatedResult(data, total, { page, limit, skip });
  }

  async importPlan(fileBuffer: Buffer, userId: number) {
    const parsedData = await parseExcelBuffer(fileBuffer);

    // Validate and prepare data
    const dataToInsert = prepareDataForInsert(parsedData);

    const collectorId = dataToInsert.map(d => d.collectorId);

    if (dataToInsert.length === 0) {
      return { message: 'No valid records found', insertedCount: 0 };
    }
    const assignments = await loanAssignments(collectorId);

    const enrichedData = dataToInsert.map(item => ({
      ...item,
      loanIds: assignments[item.collectorId] ?? []
    }));

    // Insert targets in bulk
    const insertedRows = await this.prisma.collectorsMonthlyTarget.createMany({
      data: enrichedData,
      skipDuplicates: true,
    });

    // Get unique collector IDs
    const collectorIds = [...new Set(dataToInsert.map(d => d.collectorId))];

    // Fetch existing reports and identify frozen ones
    const existingReports = await fetchExistingReports(dataToInsert, collectorIds);

    const frozenKeys = new Set(
      existingReports
        .filter(r => r.status === CollectorMonthlyReport_status.FROZEN)
        .map(r => `${r.collectorId}-${r.year}-${r.month}`)
    );

    const collectorStats = await calculateCollectorLoanStats(collectorIds);

    // Separate data into creates and updates
    const { toCreate, toUpdate } = await separateCreatesAndUpdates(
      dataToInsert,
      existingReports,
      frozenKeys,
      collectorStats,
      userId
    );

    // Execute batch operations
    await executeBatchOperations(toCreate, toUpdate);

    return {
      message: 'Excel imported successfully',
      insertedCount: insertedRows.count,
      totalRecords: parsedData.length,
      skippedRecords: parsedData.length - dataToInsert.length,
      processedReports: toCreate.length + toUpdate.length,
    };
  }
}