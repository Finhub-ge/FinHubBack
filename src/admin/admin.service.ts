import { BadRequestException, HttpException, Injectable, ParseUUIDPipe } from "@nestjs/common";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { randomUUID } from "crypto";
import { CreateTaskDto } from "./dto/createTask.dto";
import { Tasks_status, User, Committee_status } from '@prisma/client';
import { CreateTaskResponseDto } from "./dto/createTaskResponse.dto";
import { GetTasksFilterDto } from "./dto/getTasksFilter.dto";
import { ResponseCommitteeDto } from "./dto/responseCommittee.dto";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { CreateChargeDto } from "./dto/create-charge.dto";
import { S3Helper } from "src/helpers/s3.helper";
import { CreateTeamDto } from "./dto/createTeam.dto";
import { ManageTeamUsersDto } from "./dto/manageTeamUsers.dto";

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentHelper: PaymentsHelper,
    private s3Helper: S3Helper
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
        },
        Loan: {
          select: {
            caseId: true,
            publicId: true,
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

  async addPayment(publicId: ParseUUIDPipe, data: CreatePaymentDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId) },
      include: { LoanStatus: true }
    });

    if (!loan) {
      throw new HttpException('Loan not found', 404);
    }

    let loanRemaining = await this.prisma.loanRemaining.findFirst({
      where: { loanId: loan.id }
    });

    if (!loanRemaining) {
      throw new HttpException('Loan remaining balance not found', 404);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
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
            legal: 0
          }
        });

        // If LoanRemaining doesn't exist, create it with initial values from Loan implement later
        const allocationResult = await this.paymentHelper.allocatePayment(
          transaction.id,
          Number(data.amount || 0),
          loanRemaining,
          tx
        );

        await this.paymentHelper.updateTransactionSummary(
          transaction.id,
          allocationResult.transactionSummary,
          tx
        );

        await this.paymentHelper.updateLoanRemaining(
          loanRemaining.id,
          allocationResult.newBalances,
          allocationResult.newCurrentDebt,
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

      if (!currentRemaining) {
        await tx.loanRemaining.create({
          data: {
            loanId: committee.loanId,
            principal: committee.Loan.principal,
            interest: committee.Loan.interest,
            penalty: committee.Loan.penalty,
            otherFee: committee.Loan.otherFee,
            legalCharges: committee.Loan.legalCharges,
            currentDebt: committee.Loan.totalDebt,
            agreementMin: data.agreementMinAmount,
          }
        });
      } else {
        await tx.loanRemaining.update({
          where: { id: currentRemaining.id },
          data: { deletedAt: new Date() },
        });

        await tx.loanRemaining.create({
          data: {
            loanId: currentRemaining.loanId,
            principal: currentRemaining.principal,
            interest: currentRemaining.interest,
            penalty: currentRemaining.penalty,
            otherFee: currentRemaining.otherFee,
            legalCharges: currentRemaining.legalCharges,
            currentDebt: currentRemaining.currentDebt,
            agreementMin: data.agreementMinAmount,
          },
        });
      }

      return { message: 'Committee response submitted successfully' };
    });
  }

  async getAllCommittees() {
    const committees = await this.prisma.committee.findMany({
      where: {
        deletedAt: null
      },
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
            }
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return committees;
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

  async getLoanMarks() {
    return await this.prisma.loanMarks.findMany({
      where: {
        deletedAt: null
      },
      include: {
        Marks: {
          select: {
            title: true
          }
        },
        Loan: {
          select: {
            publicId: true,
            caseId: true,
            principal: true,
            Debtor: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            Portfolio: {
              select: {
                name: true
              }
            },
            LoanAssignment: {
              where: {
                isActive: true,
                unassignedAt: null
              },
              select: {
                User: {
                  select: {
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

  async addCharge(publicId: ParseUUIDPipe, data: CreateChargeDto, userId: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { publicId: String(publicId) }
    });
    if (!loan) throw new HttpException('Loan not found', 404)

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

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          legalCharges: {
            increment: Number(data.amount)
          },
          totalDebt: {
            increment: Number(data.amount)
          }
        }
      });
    });

    return {
      message: 'Charge added successfully'
    }
  }

  async getCharges() {
    return await this.prisma.charges.findMany({
      where: {
        deletedAt: null
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
      }
    })
  }

  async getPortfolios() {
    return await this.prisma.portfolio.findMany({
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