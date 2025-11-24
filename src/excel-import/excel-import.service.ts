import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParserHelper, ParsedExcelData } from './helpers/excel-parser.helper';
import { DataMapperHelper } from './helpers/data-mapper.helper';
import { ImportResultDto } from './dto/import-result.dto';
import { LoanStatusId } from 'src/enums/loanStatus.enum';

@Injectable()
export class ExcelImportService {
  private readonly logger = new Logger(ExcelImportService.name);

  constructor(
    private prisma: PrismaService,
    private excelParser: ExcelParserHelper,
    private dataMapper: DataMapperHelper,
  ) { }

  async processExcelFile(
    buffer: Buffer,
    userId: number,
  ): Promise<ImportResultDto> {
    this.logger.log('Starting Excel file processing...');

    try {
      // Step 1: Parse the Excel file
      const parsedData = await this.excelParser.parseExcelFile(buffer);
      this.logger.log(`Parsed ${parsedData.attributes.length} attribute rows`);
      this.logger.log(`Parsed ${parsedData.payments.length} payment rows`);
      this.logger.log(`Parsed ${parsedData.guarantors.length} guarantor rows`);
      this.logger.log(`Parsed ${parsedData.distribution.length} distribution rows`);

      // Step 2: Process the data
      const result = await this.importData(parsedData, userId);

      this.logger.log('Excel file processing completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Error processing Excel file:', error);
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`,
      );
    }
  }

  private async importData(
    data: ParsedExcelData,
    userId: number,
  ): Promise<ImportResultDto> {
    const errors: ImportResultDto['errors'] = [];
    const summary: ImportResultDto['summary'] = {
      portfoliosProcessed: 0,
      debtorsCreated: 0,
      debtorsUpdated: 0,
      loansCreated: 0,
      loansUpdated: 0,
      transactionsCreated: 0,
      guarantorsCreated: 0,
      assignmentsCreated: 0,
      attributesCreated: 0,
    };

    // Step 1: Get or create portfolios
    const portfolioMap = await this.processPortfolios(data.attributes);
    summary.portfoliosProcessed = portfolioMap.size;

    // Step 2: Process debtors and loans
    const { debtorMap, loanMap } = await this.processDebtorsAndLoans(
      data.attributes,
      portfolioMap,
      errors,
      summary,
    );

    // Step 3: Process loan attributes
    if (loanMap.size > 0) {
      summary.attributesCreated = await this.processLoanAttributes(
        data.attributes,
        loanMap,
        errors,
      );
    }

    // Step 4: Process transactions
    if (data.payments.length > 0 && loanMap.size > 0) {
      summary.transactionsCreated = await this.processTransactions(
        data.payments,
        loanMap,
        userId,
        errors,
      );
    }

    // Step 5: Process guarantors
    if (data.guarantors.length > 0 && debtorMap.size > 0) {
      summary.guarantorsCreated = await this.processGuarantors(
        data.guarantors,
        debtorMap,
        loanMap,
        errors,
      );
    }

    // Step 6: Process assignments
    if (data.distribution.length > 0 && loanMap.size > 0) {
      summary.assignmentsCreated = await this.processAssignments(
        data.distribution,
        loanMap,
        userId,
        errors,
      );
    }

    return {
      success: true,
      message: 'Excel data imported successfully',
      summary,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async processPortfolios(
    attributeRows: ParsedExcelData['attributes'],
  ): Promise<Map<string, number>> {
    const portfolioMap = new Map<string, number>();
    const portfolioNames = new Set(
      attributeRows
        .map((row) => row.portfolioname)
        .filter((name) => name !== undefined),
    );

    for (const name of portfolioNames) {
      // Check if portfolio exists
      let portfolio = await this.prisma.portfolio.findFirst({
        where: { name, deletedAt: null },
      });

      if (!portfolio) {
        // Create new portfolio with default values
        // portfolio = await this.prisma.portfolio.create({
        //   data: {
        //     name,
        //     purchasePrice: 0,
        //     purchaseDate: new Date(),
        //     bankName: 'Unknown',
        //   },
        // });
        this.logger.log(`Created new portfolio: ${name}`);
      }

      // portfolioMap.set(name, portfolio.id);
    }

    return portfolioMap;
  }

  private async processDebtorsAndLoans(
    attributeRows: ParsedExcelData['attributes'],
    portfolioMap: Map<string, number>,
    errors: ImportResultDto['errors'],
    summary: ImportResultDto['summary'],
  ): Promise<{ debtorMap: Map<string, number>; loanMap: Map<string, number> }> {
    const debtorMap = new Map<string, number>();
    const loanMap = new Map<string, number>();

    // Get default status IDs
    const defaultDebtorStatus = await this.prisma.debtorStatus.findFirst({
      where: { name: '', deletedAt: null },
    });

    const defaultLoanStatus = await this.prisma.loanStatus.findFirst({
      where: { id: LoanStatusId.NEW, deletedAt: null },
    });
    console.log('defaultLoanStatus', defaultLoanStatus)
    if (!defaultDebtorStatus || !defaultLoanStatus) {
      throw new BadRequestException(
        'Default statuses not found in database. Please ensure DebtorStatus and LoanStatus tables have "Active" status.',
      );
    }

    for (let i = 0; i < attributeRows.length; i++) {
      const row = attributeRows[i];

      try {
        // Map debtor
        const mappedDebtor = this.dataMapper.mapAttributeRowToDebtor(row);
        if (!mappedDebtor) {
          continue;
        }

        // Check if debtor exists
        let debtor = await this.prisma.debtor.findUnique({
          where: { idNumber: mappedDebtor.idNumber },
        });

        if (debtor) {
          // Update existing debtor
          // debtor = await this.prisma.debtor.update({
          //   where: { id: debtor.id },
          //   data: {
          //     firstName: mappedDebtor.firstName || debtor.firstName,
          //     lastName: mappedDebtor.lastName || debtor.lastName,
          //     birthdate: mappedDebtor.birthdate || debtor.birthdate,
          //     mainPhone: mappedDebtor.mainPhone || debtor.mainPhone,
          //     mainAddress: mappedDebtor.mainAddress || debtor.mainAddress,
          //   },
          // });
          summary.debtorsUpdated++;
        } else {
          // Create new debtor
          // debtor = await this.prisma.debtor.create({
          //   data: {
          //     idNumber: mappedDebtor.idNumber,
          //     firstName: mappedDebtor.firstName,
          //     lastName: mappedDebtor.lastName,
          //     birthdate: mappedDebtor.birthdate,
          //     mainPhone: mappedDebtor.mainPhone,
          //     mainAddress: mappedDebtor.mainAddress,
          //     statusId: defaultDebtorStatus.id, 1
          //   },
          // });
          summary.debtorsCreated++;
        }
        // console.log(
        //   {
        //     idNumber: mappedDebtor.idNumber,
        //     firstName: mappedDebtor.firstName,
        //     lastName: mappedDebtor.lastName,
        //     birthdate: mappedDebtor.birthdate,
        //     mainPhone: mappedDebtor.mainPhone,
        //     mainAddress: mappedDebtor.mainAddress,
        //     statusId: defaultDebtorStatus.id,
        //   },
        // )

        debtorMap.set(mappedDebtor.idNumber, debtor.id);

        // Map and create/update loan
        const mappedLoan = this.dataMapper.mapAttributeRowToLoan(row);
        // console.log('mappedLoan', mappedLoan)
        if (mappedLoan && portfolioMap.has(mappedLoan.portfolioName)) {
          const portfolioId = portfolioMap.get(mappedLoan.portfolioName)!;

          // Check if loan exists by caseId or loan number matching
          let loan = await this.prisma.loan.findFirst({
            where: {
              debtorId: debtor.id,
              OR: [
                { caseId: mappedLoan.caseId },
              ],
              deletedAt: null,
            },
          });
          console.log('loan', loan)
          if (loan) {
            // Update existing loan
            // loan = await this.prisma.loan.update({
            //   where: { id: loan.id },
            //   data: {
            //     principal: mappedLoan.principal,
            //     interest: mappedLoan.interest || 0,
            //     penalty: mappedLoan.penalty || 0,
            //     otherFee: mappedLoan.otherFee || 0,
            //     actDays: mappedLoan.actDays || 0,
            //     currency: mappedLoan.currency,
            //   },
            // });
            summary.loansUpdated++;
          } else {
            // Create new loan
            // loan = await this.prisma.loan.create({
            //   data: {
            //     debtorId: debtor.id,
            //     portfolioId,
            //     caseId: mappedLoan.caseId,
            //     principal: mappedLoan.principal,
            //     interest: mappedLoan.interest || 0,
            //     penalty: mappedLoan.penalty || 0,
            //     otherFee: mappedLoan.otherFee || 0,
            //     purchasedAmount: mappedLoan.purchasedAmount,
            //     loanStartDate: mappedLoan.loanStartDate,
            //     loanDueDate: mappedLoan.loanDueDate,
            //     statusId: defaultLoanStatus.id,
            //     currency: mappedLoan.currency,
            //     actDays: mappedLoan.actDays || 0,
            //   },
            // });
            summary.loansCreated++;
          }

          loanMap.set(mappedLoan.loanNumber, loan.id);
        }
      } catch (error) {
        errors.push({
          sheet: 'Atributes',
          row: i + 5, // Adjust for header rows
          message: error.message,
        });
        this.logger.warn(`Error processing attribute row ${i + 5}: ${error.message}`);
      }
    }

    return { debtorMap, loanMap };
  }

  private async processLoanAttributes(
    attributeRows: ParsedExcelData['attributes'],
    loanMap: Map<string, number>,
    errors: ImportResultDto['errors'],
  ): Promise<number> {
    let count = 0;

    // Get or create all attributes
    const attributeNameMap = new Map<string, number>();

    for (let i = 0; i < attributeRows.length; i++) {
      const row = attributeRows[i];

      try {
        const attributes = this.dataMapper.mapAttributeRowToAttributes(row);

        for (const attr of attributes) {
          if (!loanMap.has(attr.loanNumber)) {
            continue;
          }

          const loanId = loanMap.get(attr.loanNumber)!;

          // Get or create attribute definition
          if (!attributeNameMap.has(attr.attributeName)) {
            let attrDef = await this.prisma.attributes.findFirst({
              where: { name: attr.attributeName, deletedAt: null },
            });

            if (!attrDef) {
              // attrDef = await this.prisma.attributes.create({
              //   data: { name: attr.attributeName },
              // });
            }

            attributeNameMap.set(attr.attributeName, attrDef.id);
          }

          const attributeId = attributeNameMap.get(attr.attributeName)!;

          // Create or update loan attribute
          const existing = await this.prisma.loanAttribute.findFirst({
            where: {
              loanId,
              attributeId,
              deletedAt: null,
            },
          });

          if (existing) {
            // await this.prisma.loanAttribute.update({
            //   where: { id: existing.id },
            //   data: { value: attr.value },
            // });
          } else {
            // await this.prisma.loanAttribute.create({
            //   data: {
            //     loanId,
            //     attributeId,
            //     value: attr.value,
            //   },
            // });
            count++;
          }
        }
      } catch (error) {
        errors.push({
          sheet: 'Atributes',
          row: i + 5,
          field: 'attributes',
          message: error.message,
        });
      }
    }

    return count;
  }

  private async processTransactions(
    paymentRows: ParsedExcelData['payments'],
    loanMap: Map<string, number>,
    userId: number,
    errors: ImportResultDto['errors'],
  ): Promise<number> {
    let count = 0;

    for (let i = 0; i < paymentRows.length; i++) {
      const row = paymentRows[i];

      try {
        const mapped = this.dataMapper.mapPaymentRowToTransaction(row);
        if (!mapped) {
          continue;
        }

        const loanNumberStr = mapped.loanNumber.toString();
        if (!loanMap.has(loanNumberStr)) {
          continue; // Skip transactions for loans not in this import
        }

        const loanId = loanMap.get(loanNumberStr)!;

        // Check if transaction already exists (by loan, date, and amount)
        const existing = await this.prisma.transaction.findFirst({
          where: {
            loanId,
            paymentDate: mapped.paymentDate,
            amount: mapped.amount,
            deleted: 0,
          },
        });

        if (!existing) {
          // await this.prisma.transaction.create({
          //   data: {
          //     loanId,
          //     userId,
          //     amount: mapped.amount,
          //     paymentDate: mapped.paymentDate,
          //     principal: mapped.principal,
          //     interest: mapped.interest,
          //     penalty: mapped.penalty,
          //     fees: mapped.fees,
          //     currency: mapped.currency,
          //   },
          // });
          count++;
        }
      } catch (error) {
        errors.push({
          sheet: 'Paymants',
          row: i + 2,
          message: error.message,
        });
      }
    }

    return count;
  }

  private async processGuarantors(
    guarantorRows: ParsedExcelData['guarantors'],
    debtorMap: Map<string, number>,
    loanMap: Map<string, number>,
    errors: ImportResultDto['errors'],
  ): Promise<number> {
    let count = 0;

    for (let i = 0; i < guarantorRows.length; i++) {
      const row = guarantorRows[i];

      try {
        const mapped = this.dataMapper.mapGuarantorRow(row);
        if (!mapped) {
          continue;
        }

        const loanNumberStr = mapped.loanNumber.toString();
        if (!loanMap.has(loanNumberStr)) {
          continue;
        }

        const loanId = loanMap.get(loanNumberStr)!;

        // Get the loan to find the debtor
        const loan = await this.prisma.loan.findUnique({
          where: { id: loanId },
          select: { debtorId: true },
        });

        if (!loan) {
          continue;
        }

        // Check if guarantor already exists
        const existing = await this.prisma.debtorGuarantors.findFirst({
          where: {
            debtorId: loan.debtorId,
            idNumber: mapped.idNumber,
            deletedAt: null,
          },
        });

        if (!existing) {
          // await this.prisma.debtorGuarantors.create({
          //   data: {
          //     debtorId: loan.debtorId,
          //     firstName: mapped.firstName,
          //     lastName: mapped.lastName || '',
          //     phone: mapped.phone,
          //     mobile: mapped.mobile,
          //     address: mapped.address,
          //     idNumber: mapped.idNumber,
          //   },
          // });
          count++;
        }
      } catch (error) {
        errors.push({
          sheet: 'Guarantors',
          row: i + 4,
          message: error.message,
        });
      }
    }

    return count;
  }

  private async processAssignments(
    distributionRows: ParsedExcelData['distribution'],
    loanMap: Map<string, number>,
    userId: number,
    errors: ImportResultDto['errors'],
  ): Promise<number> {
    let count = 0;

    // Get collector role
    const collectorRole = await this.prisma.role.findFirst({
      where: { name: 'collector', deletedAt: null },
    });

    if (!collectorRole) {
      this.logger.warn('Collector role not found, skipping assignments');
      return 0;
    }

    for (let i = 0; i < distributionRows.length; i++) {
      const row = distributionRows[i];

      try {
        if (!row.caseId || !row.collector) {
          continue;
        }

        const caseIdStr = row.caseId.toString();
        if (!loanMap.has(caseIdStr)) {
          continue;
        }

        const loanId = loanMap.get(caseIdStr)!;

        // Find user by name (this is a simplification - in production you might want a better lookup)
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { firstName: { contains: row.collector } },
              { lastName: { contains: row.collector } },
            ],
            deletedAt: null,
          },
        });

        if (!user) {
          continue;
        }

        // Check if assignment exists
        const existing = await this.prisma.loanAssignment.findFirst({
          where: {
            loanId,
            userId: user.id,
            deletedAt: null,
          },
        });

        if (!existing) {
          // await this.prisma.loanAssignment.create({
          //   data: {
          //     loanId,
          //     userId: user.id,
          //     roleId: collectorRole.id,
          //     assignedBy: userId,
          //   },
          // });
          count++;
        }
      } catch (error) {
        errors.push({
          sheet: 'Distribution',
          row: i + 2,
          message: error.message,
        });
      }
    }

    return count;
  }
}
