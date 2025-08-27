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
import { GetBodyDto } from "./dto/get-body.dto";
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

  async addPayment(publicId: ParseUUIDPipe, data: CreatePaymentDto) {

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
    const committee = await this.prisma.committee.findUnique({
      where: {
        id: committeeId,
        status: Committee_status.pending
      }
    });

    if (!committee) {
      throw new BadRequestException('Committee request not found or already processed');
    }

    await this.prisma.committee.update({
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

    throw new HttpException('Committee response submitted successfully', 200);
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
            originalPrincipal: true,
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

  async fillPdf(data: GetBodyDto) {
    // Read the PDF template file
    const fs = require('fs');
    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const path = require('path');

    // Get template path - use process.cwd() to get the project root
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'თბს ცნობა.pdf');

    // Read the template file
    const templateBytes = fs.readFileSync(templatePath);

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Get the first page
    const page = pdfDoc.getPages()[0];

    let font;

    try {
      // Try to embed a Georgian-supporting font
      // Option 1: Use a Georgian font file (recommended)
      const georgianFontPath = path.join(process.cwd(), 'src', 'fonts', 'NotoSansGeorgian-Regular.ttf');

      if (fs.existsSync(georgianFontPath)) {
        const georgianFontBytes = fs.readFileSync(georgianFontPath);
        font = await pdfDoc.embedFont(georgianFontBytes);
        console.log('Using Georgian font');
      } else {
        throw new Error('Georgian font not found');
      }
    } catch (error) {
      console.warn('Georgian font not available, trying fallback options...');

      try {
        // Option 2: Try Helvetica (better Unicode support than TimesRoman)
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        console.log('Using Helvetica font');
      } catch (helError) {
        // Option 3: Convert Georgian text to transliterated version as last resort
        console.warn('Standard fonts don\'t support Georgian, using transliteration...');
        font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

        // Simple Georgian to Latin transliteration map
        const georgianToLatin = {
          'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z',
          'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o',
          'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'f',
          'ქ': 'q', 'ღ': 'gh', 'ყ': 'k', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz',
          'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
        };

        // Function to transliterate Georgian text
        const transliterate = (text) => {
          return text.split('').map(char => georgianToLatin[char] || char).join('');
        };

        // Apply transliteration to Georgian text fields
        data.fullName = transliterate(data.fullName);
        data.insuranseDate = transliterate(data.insuranseDate);
        data.docNumber = transliterate(data.docNumber);
      }
    }

    console.log('Full name:', data.fullName);
    const { width, height } = page.getSize();

    // Draw all fields
    console.log('Drawing all fields:', data);

    try {
      // Full Name
      page.drawText(data.fullName || '', {
        x: 200,
        y: height - 210,
        size: 11,
        font: font
      });

      // ID
      page.drawText(data.ID || '', {
        x: 200,
        y: height - 240,
        size: 11,
        font: font
      });

      // Insurance Date
      page.drawText(data.insuranseDate || '', {
        x: 200,
        y: height - 270,
        size: 11,
        font: font
      });

      // Document Number
      page.drawText(data.docNumber || '', {
        x: 200,
        y: height - 300,
        size: 11,
        font: font
      });

      // Amount
      page.drawText(data.amount?.toString() || '0', {
        x: 200,
        y: height - 330,
        size: 11,
        font: font
      });

    } catch (drawError) {
      console.error('Error drawing text:', drawError);
      throw new Error(`Failed to draw text: ${drawError.message}`);
    }

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();

    // Return the PDF bytes as Buffer
    return Buffer.from(pdfBytes);
  }
}