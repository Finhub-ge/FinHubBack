import { BadRequestException, HttpException, Injectable, NotFoundException, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { randomUUID } from "crypto";
import { CreateTaskDto } from "./dto/createTask.dto";
import { User, Committee_status, Committee_type, StatusMatrix_entityType, CollectorMonthlyReport_status, TeamMembership_teamRole, Prisma, CurrencyExchange_currency } from '@prisma/client';
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
import { createInitialLoanRemaining, isTeamLead, updateLoanRemaining } from "src/helpers/loan.helper";
import { GetPaymentReportWithPaginationDto } from "./dto/getPaymentReport.dto";
import { GetChargeReportWithPaginationDto } from "./dto/getChargeReport.dto";
import { addDays } from "src/helpers/date.helper";
import { Role } from "src/enums/role.enum";
import { GetFuturePaymentsWithPaginationDto } from "./dto/getFuturePayments.dto";
import { UploadPlanDto } from "src/admin/dto/uploadPlan.dto";
import { parseExcelBuffer } from "src/helpers/excel.helper";
import { normalizeName } from "src/helpers/accountId.helper";
import { calculateCollectorLoanStats, executeBatchOperations, fetchExistingReports, loanAssignments, prepareDataForInsert, separateCreatesAndUpdates, updateCollectedAmount } from "src/helpers/reports.helper";
import { buildLoanQuery } from "src/helpers/loanFilter.helper";
import { PermissionsHelper } from "src/helpers/permissions.helper";
import { logAssignmentHistory } from "src/helpers/loan.helper";
import { CurrencyHelper } from "src/helpers/currency.helper";
import { createEmptyTransactionWithLoan, findLoanBySearchTerm } from "src/helpers/transaction.helper";

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper,
    private s3Helper: S3Helper,
    private readonly paginationService: PaginationService,
    private readonly permissionsHelper: PermissionsHelper,
    private readonly currencyHelper: CurrencyHelper,
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
    const { page, limit, search } = getPaymentDto;

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
          Debtor: true,
          LoanRemaining: {
            where: { deletedAt: null }
          },
          PaymentCommitment: {
            where: { deletedAt: null, isActive: 1 },
            orderBy: { createdAt: Prisma.SortOrder.asc },
            take: 1,
            include: {
              PaymentSchedule: {
                where: { deletedAt: null }
              }
            }
          },
          LoanStatus: true,
          Portfolio: true,
          LoanAssignment: {
            where: { isActive: true },
            select: {
              createdAt: true,
              User: { select: { id: true, firstName: true, lastName: true } },
              Role: { select: { name: true } },
            },
          },
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
        }
      });
    }

    const where: any = {
      deleted: 0,
    };

    const loanFilter: any = {};
    if (search?.trim()) {
      const term = search.trim();
      const fullSearch: any[] = [];

      fullSearch.push({ Loan: { is: { caseId: term } } });

      fullSearch.push({
        Loan: {
          is: {
            Debtor: {
              OR: [
                { firstName: { contains: term } },
                { lastName: { contains: term } },
                { idNumber: { contains: term } },
              ],
            },
          },
        },
      });

      fullSearch.push({
        User: {
          is: {
            OR: [
              { firstName: { contains: term } },
              { lastName: { contains: term } },
            ].filter(Boolean),
          },
        },
      });

      where.OR = fullSearch;
    }

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

    if (Object.keys(loanFilter).length > 0) {
      where.Loan = { is: loanFilter };
    }

    const queryOptions: any = {
      where,
      include: includes,
      ...paginationParams,
      orderBy: { id: 'desc' },
    };


    const [data, total] = await Promise.all([
      this.permissionsHelper.payment.findMany(queryOptions),
      this.permissionsHelper.payment.count({
        where,
      }),
    ]);

    // const data = await this.prisma.transaction.findMany({
    //   where,
    //   include: includes,
    //   ...paginationParams,
    //   orderBy: { id: 'desc' },
    // });

    // const total = await this.prisma.transaction.count({
    //   where,
    // });

    //NEW LOGIC: If no transactions found AND search exists, look for loan
    let finalData = data;
    let finalTotal = total;

    if (data.length === 0 && search?.trim()) {
      const loan = await findLoanBySearchTerm(this.prisma, search.trim());

      if (loan) {
        // Create transaction-like object with null fields but populated loan
        const emptyTransaction = createEmptyTransactionWithLoan(loan);

        finalData = [emptyTransaction];
        finalTotal = 1;
      }
    }

    const paymentChannels = await this.paymentHelper.gettransactionChannels()
    const dataObj = {
      transactions: finalData,
      paymentChannels,
    };

    // Calculate summary (respects filters, not pagination)
    let summary = null;
    if (options?.isReport) {
      const allTransactions = await this.permissionsHelper.payment.findMany({
        where,
        select: {
          currency: true,
          amount: true,
          principal: true,
          interest: true,
          penalty: true,
          fees: true,
          legal: true,
        },
      });

      // Initialize summary for all currencies
      summary = {
        GEL: { title: 'GEL', totalCases: 0, totalAmount: 0, totalPrincipal: 0, totalInterest: 0, totalPenalty: 0, totalOtherFees: 0, totalLegalCharges: 0, totalCollection: 0 },
        USD: { title: 'USD', totalCases: 0, totalAmount: 0, totalPrincipal: 0, totalInterest: 0, totalPenalty: 0, totalOtherFees: 0, totalLegalCharges: 0, totalCollection: 0 },
        EUR: { title: 'EUR', totalCases: 0, totalAmount: 0, totalPrincipal: 0, totalInterest: 0, totalPenalty: 0, totalOtherFees: 0, totalLegalCharges: 0, totalCollection: 0 },
      };

      // Aggregate by currency
      allTransactions.forEach((transaction) => {
        const currency = transaction.currency?.toUpperCase() || 'GEL';

        if (summary[currency]) {
          summary[currency].totalCases += 1;
          summary[currency].totalAmount += Number(transaction.amount || 0);
          summary[currency].totalPrincipal += Number(transaction.principal || 0);
          summary[currency].totalInterest += Number(transaction.interest || 0);
          summary[currency].totalPenalty += Number(transaction.penalty || 0);
          summary[currency].totalOtherFees += Number(transaction.fees || 0);
          summary[currency].totalLegalCharges += Number(transaction.legal || 0);
          summary[currency].totalCollection += Number(transaction.amount || 0) + Number(transaction.legal || 0);
        }
      });

      // Round to 2 decimal places
      Object.keys(summary).forEach((currency) => {
        summary[currency].totalAmount = Number(summary[currency].totalAmount.toFixed(2));
        summary[currency].totalPrincipal = Number(summary[currency].totalPrincipal.toFixed(2));
        summary[currency].totalInterest = Number(summary[currency].totalInterest.toFixed(2));
        summary[currency].totalPenalty = Number(summary[currency].totalPenalty.toFixed(2));
        summary[currency].totalOtherFees = Number(summary[currency].totalOtherFees.toFixed(2));
        summary[currency].totalLegalCharges = Number(summary[currency].totalLegalCharges.toFixed(2));
        summary[currency].totalCollection = Number(summary[currency].totalCollection.toFixed(2));
      });
    }

    const paginatedResult = this.paginationService.createPaginatedResult([dataObj], finalTotal, { page, limit });

    // Add summary to response if it's a report
    if (options?.isReport && summary) {
      return {
        ...paginatedResult,
        summary,
      };
    }

    return paginatedResult;
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
    const currencyRate = loan.currency !== CurrencyExchange_currency.GEL ? await this.currencyHelper.getExchangeRate(data.paymentDate, loan.currency) : 1;
    data.amount = (Number(data.amount) / currencyRate).toFixed(2).toString();

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
            currency: loan.currency,
            rate: currencyRate,
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

  async deleteTransaction(id: number, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Get transaction with all related data
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: {
          Loan: {
            include: {
              LoanStatus: true,
              LoanRemaining: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 }
            }
          }
        }
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.deleted === 1) {
        throw new BadRequestException('Transaction already deleted');
      }

      const loan = transaction.Loan;
      const currentRemaining = loan.LoanRemaining[0];

      if (!currentRemaining) {
        throw new NotFoundException('Loan remaining balance not found');
      }

      // 2. Check if there are transactions after this one (prevent out-of-order deletion)
      const laterTransactions = await tx.transaction.count({
        where: {
          loanId: loan.id,
          createdAt: { gt: transaction.createdAt },
          deleted: 0,
        }
      });

      if (laterTransactions > 0) {
        throw new BadRequestException(
          'Cannot delete this transaction. There are newer transactions that depend on it. Delete newer transactions first.'
        );
      }

      // 3. Get balance history for this transaction
      const balanceHistory = await tx.loanBalanceHistory.findFirst({
        where: {
          sourceType: 'PAYMENT',
          sourceId: transaction.id,
          deletedAt: null
        }
      });

      // 4. REVERSE ALLOCATION - Add back the amounts that were paid
      const newBalances = {
        principal: Number(currentRemaining.principal) + Number(transaction.principal || 0),
        interest: Number(currentRemaining.interest) + Number(transaction.interest || 0),
        penalty: Number(currentRemaining.penalty) + Number(transaction.penalty || 0),
        otherFee: Number(currentRemaining.otherFee) + Number(transaction.fees || 0),
        legalCharges: Number(currentRemaining.legalCharges) + Number(transaction.legal || 0),
      };

      const newCurrentDebt = Number(currentRemaining.currentDebt) + Number(transaction.amount || 0);

      // 5. SOFT DELETE old LoanRemaining and CREATE new one with reverted balances
      await tx.loanRemaining.update({
        where: { id: currentRemaining.id },
        data: { deletedAt: new Date() }
      });

      await tx.loanRemaining.create({
        data: {
          loanId: loan.id,
          principal: newBalances.principal,
          interest: newBalances.interest,
          penalty: newBalances.penalty,
          otherFee: newBalances.otherFee,
          legalCharges: newBalances.legalCharges,
          currentDebt: newCurrentDebt,
          agreementMin: currentRemaining.agreementMin,
        }
      });

      // 6. SOFT DELETE balance history
      if (balanceHistory) {
        await tx.loanBalanceHistory.update({
          where: { id: balanceHistory.id },
          data: { deletedAt: new Date() }
        });
      }

      // 7. REVERT PAYMENT SCHEDULE (if Agreement status)
      if (loan.LoanStatus.name === 'Agreement') {
        // Find schedules that were paid on this transaction's date
        const schedulesUpdated = await tx.paymentSchedule.findMany({
          where: {
            PaymentCommitment: {
              loanId: loan.id,
              type: 'agreement',
              isActive: 1,
              deletedAt: null
            },
            paidDate: transaction.paymentDate,
            deletedAt: null
          }
        });

        // Reverse payment application to schedules
        let amountToReverse = Number(transaction.amount || 0);

        for (const schedule of schedulesUpdated.reverse()) {
          if (amountToReverse <= 0) break;

          const currentPaid = Number(schedule.paidAmount || 0);
          const totalScheduled = Number(schedule.amount);
          const amountToReduceFromSchedule = Math.min(amountToReverse, currentPaid);
          const newPaidAmount = currentPaid - amountToReduceFromSchedule;

          // Determine new status
          let newStatus = 'PENDING';
          if (newPaidAmount > 0 && newPaidAmount < totalScheduled) {
            newStatus = 'PARTIAL';
          } else if (newPaidAmount >= totalScheduled) {
            newStatus = 'PAID';
          }

          await tx.paymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
              paidDate: newStatus === 'PAID' ? schedule.paidDate : null
            }
          });

          amountToReverse -= amountToReduceFromSchedule;
        }
      }

      // 8. REVERT LOAN STATUS (if was closed by this payment)
      const closingStatusHistory = await tx.loanStatusHistory.findFirst({
        where: {
          loanId: loan.id,
          newStatusId: 12,
          notes: { contains: 'loan balance reached 0' },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' }
      });

      if (closingStatusHistory && loan.statusId === 12 && newCurrentDebt > 0) {
        // Reopen the loan
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            statusId: closingStatusHistory.oldStatusId,
            closedAt: null,
          }
        });

        // Soft delete the closing status history
        await tx.loanStatusHistory.update({
          where: { id: closingStatusHistory.id },
          data: { deletedAt: new Date() }
        });

        // Create new status history for reopening
        await tx.loanStatusHistory.create({
          data: {
            loanId: loan.id,
            oldStatusId: 12,
            newStatusId: closingStatusHistory.oldStatusId,
            changedBy: userId,
            notes: `Loan reopened due to transaction deletion (Transaction ID: ${transaction.id})`,
          },
        });
      }

      // 9. REVERT COLLECTED AMOUNT (in CollectorMonthlyReport)
      await updateCollectedAmount(loan.id, -Number(transaction.amount || 0), tx);

      // 10. SOFT DELETE TRANSACTION
      await tx.transaction.update({
        where: { id },
        data: {
          deleted: 1,
        }
      });

      // 11. CREATE TRANSACTION DELETION RECORD
      await tx.transactionDeleted.create({
        data: {
          transactionId: transaction.id,
          userId: userId,
          deletedAt: new Date()
        }
      });

      return {
        message: 'Transaction deleted and all changes reverted successfully',
        transactionId: transaction.id,
      };
    });
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
    // Fetch user 79 details
    const targetUser = await this.prisma.user.findUnique({
      where: { id: 79 },
      select: { id: true, roleId: true, firstName: true, lastName: true }
    });

    if (!targetUser) {
      throw new BadRequestException('Target user (ID: 79) not found');
    }

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

      // Handle hopeless type
      const finalType = data.type || committee.type;
      if (finalType === Committee_type.hopeless) {
        // Update loan groupId to 14
        await tx.loan.update({
          where: { id: committee.loanId },
          data: { groupId: 14 }
        });

        // Find current active assignment for this role (read inside transaction for consistency)
        const currentAssignment = await tx.loanAssignment.findFirst({
          where: {
            loanId: committee.loanId,
            roleId: targetUser.roleId,
            isActive: true
          }
        });

        // If already assigned to user 79, skip reassignment
        if (currentAssignment?.userId !== 79) {
          // Deactivate current assignment if exists
          if (currentAssignment) {
            await tx.loanAssignment.update({
              where: { id: currentAssignment.id },
              data: { isActive: false, unassignedAt: new Date() }
            });

            // Log unassignment
            await logAssignmentHistory({
              prisma: tx as any,
              loanId: committee.loanId,
              userId: currentAssignment.userId,
              roleId: targetUser.roleId,
              action: 'unassigned',
              assignedBy: userId
            });
          }

          // Create new assignment to user 79
          await tx.loanAssignment.create({
            data: {
              loanId: committee.loanId,
              userId: 79,
              roleId: targetUser.roleId,
              isActive: true
            }
          });

          // Log new assignment
          await logAssignmentHistory({
            prisma: tx as any,
            loanId: committee.loanId,
            userId: 79,
            roleId: targetUser.roleId,
            action: 'assigned',
            assignedBy: userId
          });

          // Create comment for hopeless reassignment (using pre-fetched user details)
          await tx.comments.create({
            data: {
              loanId: committee.loanId,
              userId: userId,
              comment: `Hopeless case - Reassigned to ${targetUser.firstName} ${targetUser.lastName} (79) and moved to group 14`
            }
          });
        }
      }

      // Handle close type
      if (finalType === Committee_type.close) {
        // Update loan statusId to 12
        await tx.loan.update({
          where: { id: committee.loanId },
          data: { statusId: 12, closedAt: new Date() }
        });
      }

      return { message: 'Committee response submitted successfully' };
    });
  }

  async getAllCommittees(getCommiteesDto: GetCommiteesWithPaginationDto, user: any) {
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

    // For committees: team leads should see all team's committees by default
    const teamLead = isTeamLead(user);
    const LAWYER_ROLES = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'];
    const isCollector = user.role_name === Role.COLLECTOR;
    const isLawyer = LAWYER_ROLES.includes(user.role_name);

    // Team leads (collectors and lawyers) see all team's committees, members see only own
    const allowTeamAccess = teamLead && (isCollector || isLawyer);

    const queryOptions: any = {
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
            LoanAssignment: {
              where: {
                isActive: true,
              },
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
                  },
                },
              },
            },
          }
        },
        User_Committee_requesterIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        User_Committee_responderIdToUser: {
          select: {
            id: true,
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
    };

    if (allowTeamAccess) {
      queryOptions._allowTeamAccess = true;
    }

    const [committees, totalCount] = await Promise.all([
      this.permissionsHelper.committee.findMany(queryOptions),
      this.permissionsHelper.committee.count({
        where,
        ...(allowTeamAccess ? { _allowTeamAccess: true } : {})
      }),
    ]);

    return this.paginationService.createPaginatedResult(committees, totalCount, { page, limit });
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

  async getLoanMarks(getMarkReportDto: GetMarkReportWithPaginationDto, user: any) {
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

    // Determine if we should skip user scope for team leads filtering by team members
    const teamLead = isTeamLead(user);
    const hasAssignedCollectorFilter = filters.assignedCollector?.length > 0;

    // Team leads (both collectors and lawyers) can see team members' payment commitments when filtering by assignedCollector
    const LAWYER_ROLES = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'];
    const isCollector = user.role_name === Role.COLLECTOR;
    const isLawyer = LAWYER_ROLES.includes(user.role_name);
    const skipUserScope = teamLead && (isCollector || isLawyer) && hasAssignedCollectorFilter;

    const queryOptions: any = {
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
    }

    if (skipUserScope) {
      queryOptions._skipUserScope = true;
    }

    const [loanMarks, total] = await Promise.all([
      this.permissionsHelper.loanMarks.findMany(queryOptions),
      this.permissionsHelper.loanMarks.count({
        where,
        ...(skipUserScope ? { _skipUserScope: true } : {})
      }),
    ]);

    return this.paginationService.createPaginatedResult(loanMarks, total, { page, limit, skip });
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
      where: { caseId: String(data.caseId) },
      include: {
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
              }
            },
            Role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!loan) throw new HttpException('Loan not found', 404)

    const chargeType = await this.prisma.chargeType.findUnique({
      where: { id: data.chargeTypeId }
    });

    if (!chargeType) throw new HttpException('Charge type not found', 404)

    const loanRemaining = await this.prisma.loanRemaining.findFirst({
      where: { loanId: loan.id, deletedAt: null }
    });

    // Find collector and lawyer from assignments
    const collectorAssignment = loan.LoanAssignment.find(
      assignment => assignment.Role.name === 'collector'
    );
    const lawyerAssignment = loan.LoanAssignment.find(
      assignment => assignment.Role.name === 'lawyer'
    );

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
          collectorId: collectorAssignment?.User.id,
          lawyerId: lawyerAssignment?.User.id,
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
      User_Charges_collectorIdToUser: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      User_Charges_lawyerIdToUser: {
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
      },
      TransactionChannels: {
        select: {
          name: true
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
        { Loan: { caseId: searchTerm } },
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

  async getFuturePayments(getFuturePaymentsDto: GetFuturePaymentsWithPaginationDto, user: any) {
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

    const teamLead = isTeamLead(user);
    const hasAssignedCollectorFilter = getFuturePaymentsDto.assignedCollector?.length > 0;

    const LAWYER_ROLES = ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'];
    const isCollector = user.role_name === Role.COLLECTOR;
    const isLawyer = LAWYER_ROLES.includes(user.role_name);
    const skipUserScope = teamLead && (isCollector || isLawyer) && hasAssignedCollectorFilter;

    const queryOptions: any = {
      where,
      include: {
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
        },
      },
      ...paginationParams,
      orderBy: { paymentDate: 'desc' },
    };

    if (skipUserScope) {
      queryOptions._skipUserScope = true;
    }

    const [futurePayments, totalCount] = await Promise.all([
      this.permissionsHelper.futurePayment.findMany(queryOptions),
      this.permissionsHelper.futurePayment.count({
        where,
        ...(skipUserScope ? { _skipUserScope: true } : {})
      }),
    ]);

    return this.paginationService.createPaginatedResult(futurePayments, totalCount, { page, limit, skip });
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

  async getCurrency(date?: string, currency?: string) {
    // If specific currency provided, return only that one
    if (currency) {
      const rate = await this.currencyHelper.getExchangeRate(date, currency);
      return {
        success: true,
        data: {
          currency,
          rate,
          date: date
        },
      };
    }

    // Otherwise, return both USD and EUR
    const [usdRate, eurRate] = await Promise.all([
      this.currencyHelper.getExchangeRate(date, CurrencyExchange_currency.USD),
      this.currencyHelper.getExchangeRate(date, CurrencyExchange_currency.EUR),
    ]);

    return {
      success: true,
      data: {
        date: date || new Date().toISOString().split('T')[0],
        rates: {
          USD: usdRate,
          EUR: eurRate,
        },
      },
    };
  }
}