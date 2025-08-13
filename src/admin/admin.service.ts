import { BadRequestException, HttpException, Injectable, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { randomUUID } from "crypto";
import { CreateTaskDto } from "./dto/createTask.dto";
import { Tasks_status, User } from '@prisma/client';
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksFilterDto } from "./dto/getTasksFilter.dto";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper
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
    return await this.prisma.loanStatus.findMany()
  }

  async getTasks(user: User, filters: GetTasksFilterDto) {
    const {
      type,
      status,
      employeeId,
      createdDateStart,
      createdDateEnd,
      deadlineDateStart,
      deadlineDateEnd,
      completeDateStart,
      completeDateEnd
    } = filters

    const conditions = [];

    // Type filter
    if (type === 'ASSIGNED_TO_ME') {
      conditions.push({ toUserId: user.id });
    } else if (type === 'ASSIGNED_BY_ME') {
      conditions.push({ fromUser: user.id });
    }

    // Status filter
    if (status) {
      conditions.push({ status: status });
    }

    // Employee filter
    if (employeeId) {
      conditions.push({ toUserId: Number(employeeId) });
    }

    // Created date range
    if (createdDateStart || createdDateEnd) {
      const createdDateCondition: any = {};
      if (createdDateStart) {
        // Set to start of day to include all records from that date
        createdDateCondition.gte = dayjs(createdDateStart).startOf('day').toDate();
      }
      if (createdDateEnd) {
        // Set to end of day to include all records from that date
        createdDateCondition.lte = dayjs(createdDateEnd).endOf('day').toDate();
      }
      conditions.push({ createdAt: createdDateCondition });
    }

    // Deadline range
    if (deadlineDateStart || deadlineDateEnd) {
      const deadlineCondition: any = {};
      if (deadlineDateStart) {
        deadlineCondition.gte = dayjs(deadlineDateStart).startOf('day').toDate();
      }
      if (deadlineDateEnd) {
        deadlineCondition.lte = dayjs(deadlineDateEnd).endOf('day').toDate();
      }
      conditions.push({ deadline: deadlineCondition });
    }

    // Completed date range
    if (completeDateStart || completeDateEnd) {
      const completeDateCondition: any = {};
      if (completeDateStart) {
        completeDateCondition.gte = dayjs(completeDateStart).startOf('day').toDate();
      }
      if (completeDateEnd) {
        completeDateCondition.lte = dayjs(completeDateEnd).endOf('day').toDate();
      }
      conditions.push({ updatedAt: completeDateCondition });
    }

    const whereClause = conditions.length > 0 ? { AND: conditions } : {};

    return await this.prisma.tasks.findMany({
      where: whereClause,
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
        }
      }
    })
  }

  async getTransactionList() {
    const data = await this.prisma.transaction.findMany({
      where: {
        deleted: 0
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
      orderBy: {
        id: 'desc'
      }
    });

    const paymentChannels = await this.paymentHelper.gettransactionChannels()
    const dataObj = {}
    dataObj['transactions'] = data
    dataObj['paymentChannels'] = paymentChannels
    return dataObj;

  }

  async addPayment(publicId: ParseUUIDPipe, data: UpdatePaymentDto) {

    const loan = await this.prisma.loan.findUnique({
      where: {
        publicId: String(publicId)
      }
    })

    if (!loan) throw new HttpException('Loan not found', 404)

    await this.prisma.transaction.create({
      data: {
        loanId: loan.id,
        amount: Number(data.amount || 0),
        paymentDate: data.paymentDate,
        transactionChannelAccountId: data.accountId,
        publicId: randomUUID(),
      }
    })

    throw new HttpException('Payment added successfully', 200);
  }
  async updatePayment(publicId: ParseUUIDPipe, data: CreatePaymentDto) {

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
}