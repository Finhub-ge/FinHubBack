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
      { name: 'interest_rate', value: row.interestRate },
      { name: 'effective_interest_rate', value: row.effectiveInterestRate },
      { name: 'delay_date', value: row.delayDate },
      { name: 'last_payment_date', value: row.lastPaymentDate },
      { name: 'last_payment_amount', value: row.lastPaymentAmount },
      { name: 'legal_identifier', value: row.legalIdentifier },
      { name: 'legal_stage_comment', value: row.legalStageComment },
      { name: 'loan_duration', value: row.loanDuration },
      { name: 'product', value: row.product },
      { name: 'contract_number', value: row.contractNumber },
      { name: 'dead', value: row.dead },
      { name: 'borrower_status', value: row.borrowerStatus },
      { name: 'marks', value: row.marks },
      { name: 'manufacturer', value: row.manufacturer },
      { name: 'model', value: row.model },
      { name: 'production_year', value: row.productionYear },
      { name: 'vin_code', value: row.vinCode },
      { name: 'car_state_number', value: row.carStateNumber },
      { name: 'comp_legal_form', value: row.compLegalForm },
      { name: 'comp_id_number', value: row.compIdNumber },
      { name: 'term_of_validity_months', value: row.termOfValidityMonths },
      { name: 'georgian_citizen', value: row.georgianCitizen },
      { name: 'partially_secured_by_deposit', value: row.partiallySecuredByDeposit },
      { name: 'contract_status', value: row.contractStatus },
      { name: 'repayment_type', value: row.repaymentType },
      { name: 'installment_type', value: row.installmentType },
      { name: 'phase_of_contract', value: row.phaseOfContract },
      { name: 'relation_type', value: row.relationType },
      { name: 'subject_type', value: row.subjectType },
      { name: 'role_of_customer', value: row.roleOfCustomer },
      { name: 'contact_person', value: row.contactPerson },
      { name: 'contact_person_mobile', value: row.contactPersonMobile },
      { name: 'residential', value: row.residential },
      { name: 'gender', value: row.gender },
      { name: 'city', value: row.city },
      { name: 'mobile_2', value: row.mobile2 },
      { name: 'registered_address', value: row.registeredAddress },
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
