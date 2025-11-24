import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface AttributeRow {
  idNumber?: string;
  loanid?: number;
  loannumber?: string;
  portfolioid?: number;
  portfolioname?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  registeredAddress?: string;
  birthDate?: Date;
  residential?: string;
  mobile?: string;
  mobile2?: string;
  gender?: string;
  city?: string;
  interestRate?: number;
  effectiveInterestRate?: number;
  daysOverdue?: number;
  delayDate?: Date;
  initPrincipal?: number;
  casePenalty?: number;
  leftInterestFee?: number;
  otherFees?: number;
  originalPrincipal?: number;
  caseIssueDate?: Date;
  caseReturnDate?: Date;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  legalIdentifier?: string;
  legalStageComment?: string;
  currency?: string;
  loanDuration?: number;
  product?: string;
  contractNumber?: string;
  dead?: string;
  borrowerStatus?: string;
  marks?: string;
  manufacturer?: string;
  model?: string;
  productionYear?: number;
  vinCode?: string;
  carStateNumber?: string;
  compLegalForm?: string;
  compIdNumber?: string;
  termOfValidityMonths?: number;
  georgianCitizen?: string;
  partiallySecuredByDeposit?: string;
  contractStatus?: string;
  repaymentType?: string;
  installmentType?: string;
  phaseOfContract?: string;
  relationType?: string;
  subjectType?: string;
  roleOfCustomer?: string;
  contactPerson?: string;
  contactPersonMobile?: string;
}

export interface PaymentRow {
  loanNumber?: number;
  date?: Date;
  payment?: number;
  principal?: number;
  interest?: number;
  penalty?: number;
  other?: number;
  currency?: string;
}

export interface GuarantorRow {
  portfolioName?: string;
  loanNumber?: string;
  firstName?: string;
  mobile?: string;
  mobile2?: string;
  idNumber?: string;
  address?: string;
  guaranteeType?: string;
  subjectRole?: string;
}

export interface DistributionRow {
  caseId?: number;
  portfolio?: string;
  collector?: string;
}

export interface ParsedExcelData {
  attributes: AttributeRow[];
  payments: PaymentRow[];
  guarantors: GuarantorRow[];
  distribution: DistributionRow[];
}

@Injectable()
export class ExcelParserHelper {
  async parseExcelFile(buffer: Buffer): Promise<ParsedExcelData> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const attributesSheet = workbook.getWorksheet('Atributes');
    const paymentsSheet = workbook.getWorksheet('Paymants');
    const guarantorsSheet = workbook.getWorksheet('Guarantors');
    const distributionSheet = workbook.getWorksheet('განაწილება');

    if (!attributesSheet) {
      throw new BadRequestException(
        'Required sheet "Atributes" not found in Excel file',
      );
    }

    return {
      attributes: this.parseAttributesSheet(attributesSheet),
      payments: paymentsSheet ? this.parsePaymentsSheet(paymentsSheet) : [],
      guarantors: guarantorsSheet
        ? this.parseGuarantorsSheet(guarantorsSheet)
        : [],
      distribution: distributionSheet
        ? this.parseDistributionSheet(distributionSheet)
        : [],
    };
  }

  private parseAttributesSheet(
    worksheet: ExcelJS.Worksheet,
  ): AttributeRow[] {
    const data: AttributeRow[] = [];

    // Row 2: Georgian headers, Row 3: English headers, Row 4: Column numbers, Row 5+: Data
    const headerRow = worksheet.getRow(3);
    const columnMap = this.buildAttributesColumnMap(headerRow);

    // Start from row 5 (data rows)
    for (let rowNum = 5; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      // Skip empty rows
      if (this.isRowEmpty(row)) {
        continue;
      }

      const rowData: AttributeRow = {};

      // Map each column
      Object.entries(columnMap).forEach(([field, colNumber]) => {
        const cell = row.getCell(colNumber);
        const value = this.getCellValue(cell);

        if (value !== null && value !== undefined && value !== '') {
          rowData[field] = value;
        }
      });

      // Only add rows that have at least a loan number or ID
      if (rowData.loannumber || rowData.idNumber) {
        data.push(rowData);
      }
    }

    return data;
  }

  private buildAttributesColumnMap(headerRow: ExcelJS.Row): Record<string, number> {
    const columnMap: Record<string, number> = {};
    const fieldMapping: Record<string, string> = {
      'idNumber': 'idNumber',
      'loanid': 'loanid',
      'loannumber': 'loannumber',
      'portfolioid': 'portfolioid',
      'portfolioname': 'portfolioname',
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'address': 'address',
      'Registered Address': 'registeredAddress',
      'Birth Date': 'birthDate',
      'Residential': 'residential',
      'Mobile': 'mobile',
      'Mobile-2': 'mobile2',
      'Gender': 'gender',
      'City': 'city',
      'interest rate': 'interestRate',
      'Effective interest rate': 'effectiveInterestRate',
      'Days overdue': 'daysOverdue',
      'Delay Date': 'delayDate',
      'initPrincipal': 'initPrincipal',
      'Case Penalty': 'casePenalty',
      'Left Interest Fee': 'leftInterestFee',
      'Other Fees': 'otherFees',
      'Original Principal': 'originalPrincipal',
      'Case Issue Date': 'caseIssueDate',
      'Case Return Date': 'caseReturnDate',
      'Last Payment Date': 'lastPaymentDate',
      'Last Payment Amount': 'lastPaymentAmount',
      'Legal Identifier': 'legalIdentifier',
      'Legal Stage Comment': 'legalStageComment',
      'Currency': 'currency',
      'Loan Duration': 'loanDuration',
      'Product': 'product',
      'Contract Number': 'contractNumber',
      'Dead': 'dead',
      'Borrower status': 'borrowerStatus',
      'Marks': 'marks',
      'Manufacturer': 'manufacturer',
      'Model': 'model',
      'Production Year': 'productionYear',
      'VIN Code': 'vinCode',
      'Car state number': 'carStateNumber',
      'Comp Legal Form': 'compLegalForm',
      'Comp ID Number': 'compIdNumber',
      'Term of validity of the contract (months)': 'termOfValidityMonths',
      'Georgian Citizen (YES/NO)': 'georgianCitizen',
      'PartiallySecuredByDeposit': 'partiallySecuredByDeposit',
      'ContractStatus': 'contractStatus',
      'RepaymentType': 'repaymentType',
      'InstallmentType': 'installmentType',
      'PhaseOfContract': 'phaseOfContract',
      'RelationType': 'relationType',
      'SubjectType': 'subjectType',
      'Role Of Customer': 'roleOfCustomer',
      'საკონტაქტო პირი': 'contactPerson',
      'საკონტაქტო პირის მობილურის ნომერი': 'contactPersonMobile',
    };

    headerRow.eachCell((cell, colNumber) => {
      const headerValue = cell.value?.toString().trim();
      if (headerValue && fieldMapping[headerValue]) {
        columnMap[fieldMapping[headerValue]] = colNumber;
      }
    });

    return columnMap;
  }

  private parsePaymentsSheet(worksheet: ExcelJS.Worksheet): PaymentRow[] {
    const data: PaymentRow[] = [];
    const headerRow = worksheet.getRow(1);

    const columnMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString().trim();
      if (header === 'Loan Number') columnMap['loanNumber'] = colNumber;
      if (header === 'Date') columnMap['date'] = colNumber;
      if (header === 'Payment') columnMap['payment'] = colNumber;
      if (header === 'Principal') columnMap['principal'] = colNumber;
      if (header === 'Interest') columnMap['interest'] = colNumber;
      if (header === 'Penalty') columnMap['penalty'] = colNumber;
      if (header === 'Other') columnMap['other'] = colNumber;
      if (header === 'Currency') columnMap['currency'] = colNumber;
    });

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      if (this.isRowEmpty(row)) {
        continue;
      }

      const rowData: PaymentRow = {};

      if (columnMap['loanNumber']) {
        rowData.loanNumber = this.getCellValue(row.getCell(columnMap['loanNumber']));
      }
      if (columnMap['date']) {
        rowData.date = this.getCellValue(row.getCell(columnMap['date']));
      }
      if (columnMap['payment']) {
        rowData.payment = this.getCellValue(row.getCell(columnMap['payment']));
      }
      if (columnMap['principal']) {
        rowData.principal = this.getCellValue(row.getCell(columnMap['principal']));
      }
      if (columnMap['interest']) {
        rowData.interest = this.getCellValue(row.getCell(columnMap['interest']));
      }
      if (columnMap['penalty']) {
        rowData.penalty = this.getCellValue(row.getCell(columnMap['penalty']));
      }
      if (columnMap['other']) {
        rowData.other = this.getCellValue(row.getCell(columnMap['other']));
      }
      if (columnMap['currency']) {
        rowData.currency = this.getCellValue(row.getCell(columnMap['currency']));
      }

      if (rowData.loanNumber) {
        data.push(rowData);
      }
    }

    return data;
  }

  private parseGuarantorsSheet(worksheet: ExcelJS.Worksheet): GuarantorRow[] {
    const data: GuarantorRow[] = [];

    // Skip first 3 rows (header rows), start from row 4
    for (let rowNum = 4; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      if (this.isRowEmpty(row)) {
        continue;
      }

      const rowData: GuarantorRow = {
        portfolioName: this.getCellValue(row.getCell(1)),
        loanNumber: this.getCellValue(row.getCell(2)),
        firstName: this.getCellValue(row.getCell(4)),
        mobile: this.getCellValue(row.getCell(5)),
        mobile2: this.getCellValue(row.getCell(6)),
        idNumber: this.getCellValue(row.getCell(7)),
        address: this.getCellValue(row.getCell(8)),
        guaranteeType: this.getCellValue(row.getCell(9)),
        subjectRole: this.getCellValue(row.getCell(10)),
      };

      if (rowData.loanNumber && rowData.idNumber) {
        data.push(rowData);
      }
    }

    return data;
  }

  private parseDistributionSheet(worksheet: ExcelJS.Worksheet): DistributionRow[] {
    const data: DistributionRow[] = [];

    // Row 1: Headers, Row 2+: Data
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      if (this.isRowEmpty(row)) {
        continue;
      }

      const rowData: DistributionRow = {
        caseId: this.getCellValue(row.getCell(1)),
        portfolio: this.getCellValue(row.getCell(2)),
        collector: this.getCellValue(row.getCell(3)),
      };

      if (rowData.caseId) {
        data.push(rowData);
      }
    }

    return data;
  }

  private getCellValue(cell: ExcelJS.Cell): any {
    if (cell.type === ExcelJS.ValueType.Formula) {
      // Return the result of the formula, not the formula itself
      return cell.result !== undefined && cell.result !== null ? cell.result : null;
    }

    const value = cell.value;

    // Handle dates
    if (value instanceof Date) {
      return value;
    }

    // Handle numbers
    if (typeof value === 'number') {
      return value;
    }

    // Handle strings
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }

    // Handle rich text
    if (value && typeof value === 'object' && 'richText' in value) {
      return value.richText.map((rt: any) => rt.text).join('');
    }

    return value;
  }

  private isRowEmpty(row: ExcelJS.Row): boolean {
    let isEmpty = true;
    row.eachCell((cell) => {
      const value = this.getCellValue(cell);
      if (value !== null && value !== undefined && value !== '') {
        isEmpty = false;
      }
    });
    return isEmpty;
  }
}
