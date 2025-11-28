import { Injectable } from '@nestjs/common';
import { AttributeRow, PaymentRow, GuarantorRow } from './excel-parser.helper';

export interface MappedDebtor {
  idNumber: string;
  firstName?: string;
  lastName?: string;
  birthdate?: Date;
  mainPhone?: string;
  mainAddress?: string;
}

export interface MappedLoan {
  debtorIdNumber: string;
  portfolioName: string;
  loanNumber: string;
  principal: number;
  interest?: number;
  penalty?: number;
  otherFee?: number;
  purchasedAmount: number;
  loanStartDate: Date;
  loanDueDate: Date;
  currency?: string;
  actDays?: number;
  caseId?: number;
}

export interface MappedTransaction {
  loanNumber: number | string;
  amount: number;
  paymentDate: Date;
  principal?: number;
  interest?: number;
  penalty?: number;
  fees?: number;
  currency?: string;
}

export interface MappedGuarantor {
  debtorIdNumber: string;
  loanNumber: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  idNumber?: string;
}

export interface MappedAttribute {
  loanNumber: string;
  attributeName: string;
  value: string;
}

@Injectable()
export class DataMapperHelper {
  mapAttributeRowToDebtor(row: AttributeRow): MappedDebtor | null {
    if (!row.idNumber) {
      return null;
    }

    return {
      idNumber: row.idNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      birthdate: row.birthDate,
      mainPhone: row.mobile,
      mainAddress: row.address || row.registeredAddress,
    };
  }

  mapAttributeRowToLoan(row: AttributeRow): MappedLoan | null {
    if (!row.loannumber || !row.idNumber || !row.portfolioname) {
      return null;
    }

    // Use initPrincipal as the current principal, originalPrincipal as purchased amount
    const principal = row.initPrincipal || row.originalPrincipal || 0;
    const purchasedAmount = row.originalPrincipal || principal;

    // If dates are missing, use reasonable defaults
    const loanStartDate = row.caseIssueDate || new Date();
    const loanDueDate = row.caseReturnDate || new Date();

    return {
      debtorIdNumber: row.idNumber,
      portfolioName: row.portfolioname,
      loanNumber: row.loannumber.toString(),
      principal,
      interest: row.leftInterestFee || 0,
      penalty: row.casePenalty || 0,
      otherFee: row.otherFees || 0,
      purchasedAmount,
      loanStartDate,
      loanDueDate,
      currency: row.currency || 'GEL',
      actDays: row.daysOverdue || 0,
      caseId: row.loanid,
    };
  }

  mapAttributeRowToAttributes(row: AttributeRow): MappedAttribute[] {
    if (!row.loannumber) {
      return [];
    }

    const attributes: MappedAttribute[] = [];
    const loanNumber = row.loannumber.toString();

    // Map fields that should be stored as attributes
    const attributeFields = [
      { name: 'interest rate', value: row['interest rate'] },
      { name: 'Effective interest rate', value: row['Effective interest rate'] },
      { name: 'Delay Date', value: row['Delay Date'] },
      { name: 'Last Payment Date', value: row['Last Payment Date'] },
      { name: 'Last Payment Amount', value: row['Last Payment Amount'] },
      { name: 'Legal Identifier', value: row['Legal Identifier'] },
      { name: 'Legal Stage Comment', value: row['Legal Stage Comment'] },
      { name: 'Loan Duration', value: row['Loan Duration'] },
      { name: 'Product', value: row['Product'] },
      { name: 'Contract Number', value: row['Contract Number'] },
      { name: 'Dead', value: row['Dead'] },
      { name: 'Borrower status', value: row['Borrower status'] },
      { name: 'Marks', value: row['Marks'] },
      { name: 'Manufacturer', value: row['Manufacturer'] },
      { name: 'Model', value: row['Model'] },
      { name: 'Production Year', value: row['Production Year'] },
      { name: 'VIN Code', value: row['VIN Code'] },
      { name: 'Car state number', value: row['Car state number'] },
      { name: 'Comp Legal Form', value: row['Comp Legal Form'] },
      { name: 'Comp ID Number', value: row['Comp ID Number'] },
      {
        name: 'Term of validity of the contract (months)',
        value: row['Term of validity of the contract (months)'],
      },
      { name: 'Georgian Citizen (YES/NO)', value: row['Georgian Citizen (YES/NO)'] },
      { name: 'partiallySecuredByDeposit', value: row['partiallySecuredByDeposit'] },
      { name: 'ContractStatus', value: row['ContractStatus'] },
      { name: 'RepaymentType', value: row['RepaymentType'] },
      { name: 'InstallmentType', value: row['InstallmentType'] },
      { name: 'PhaseOfContract', value: row['PhaseOfContract'] },
      { name: 'RelationType', value: row['RelationType'] },
      { name: 'SubjectType', value: row['SubjectType'] },
      { name: 'Role Of Customer', value: row['Role Of Customer'] },

      // Georgian → name stays exactly same
      { name: 'საკონტაქტო პირი', value: row['საკონტაქტო პირი'] },
      { name: 'საკონტაქტო პირის მობილურის ნომერი', value: row['საკონტაქტო პირის მობილურის ნომერი'] },

      { name: 'Residential', value: row['Residential'] },
      { name: 'Gender', value: row['Gender'] },
      { name: 'City', value: row['City'] },
      { name: 'Mobile-2', value: row['Mobile-2'] },
      { name: 'Registered Address', value: row['Registered Address'] },
    ];

    for (const field of attributeFields) {
      if (field.value !== undefined && field.value !== null && field.value !== '') {
        let valueStr: string;
        if (field.value instanceof Date) {
          valueStr = field.value.toISOString();
        } else {
          valueStr = field.value.toString();
        }

        attributes.push({
          loanNumber,
          attributeName: field.name,
          value: valueStr,
        });
      }
    }

    return attributes;
  }

  mapPaymentRowToTransaction(row: PaymentRow): MappedTransaction | null {
    if (!row.loanNumber || !row.date || !row.payment) {
      return null;
    }

    return {
      loanNumber: row.loanNumber,
      amount: row.payment,
      paymentDate: row.date,
      principal: row.principal || 0,
      interest: row.interest || 0,
      penalty: row.penalty || 0,
      fees: row.other || 0,
      currency: row.currency || 'GEL',
    };
  }

  mapGuarantorRow(row: GuarantorRow): MappedGuarantor | null {
    if (!row.loanNumber || !row.idNumber) {
      return null;
    }

    // Split firstName into first and last name if it contains space
    const nameParts = row.firstName?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      debtorIdNumber: '', // Will be filled from loan lookup
      loanNumber: row.loanNumber,
      firstName,
      lastName,
      phone: row.mobile,
      mobile: row.mobile2,
      address: row.address,
      idNumber: row.idNumber,
    };
  }

  parsePhoneNumber(phone: any): string | undefined {
    if (!phone) return undefined;

    const phoneStr = phone.toString().trim();
    // Remove any non-numeric characters
    const cleaned = phoneStr.replace(/\D/g, '');

    return cleaned || undefined;
  }

  parseDecimal(value: any): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  parseDate(value: any): Date | undefined {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }

    return undefined;
  }
}
