export interface PaymentTransactionCreatedEvent {
  transactionId: number;
  loanId: number;
  amount: number;
  paymentDate: Date;
  userId: number;
  loanRemainingId: number;
  allocationResult: {
    transactionSummary: {
      principal: number;
      interest: number;
      penalty: number;
      fees: number;
      legal: number;
    };
    newBalances: {
      principal: number;
      interest: number;
      penalty: number;
      otherFee: number;
      legalCharges: number;
    };
    newCurrentDebt: number;
  };
  loanStatusName: string;
  oldLoanStatus: number;
  agreementMin: number;
}

export interface TransactionDeletedEvent {
  transactionId: number;
  loanId: number;
  amount: number;
  paymentDate: Date;
  userId: number;
  loanRemainingId: number;
  transactionSummary: {
    principal: number;
    interest: number;
    penalty: number;
    fees: number;
    legal: number;
  };
  newBalances: {
    principal: number;
    interest: number;
    penalty: number;
    otherFee: number;
    legalCharges: number;
  };
  newCurrentDebt: number;
  loanStatusName: string;
  currentLoanStatusId: number;
  balanceHistoryId: number | null;
  closingStatusHistoryId: number | null;
  oldLoanStatusId: number | null;
}

export interface ErrorProcessingFailedEvent {
  error: string;
  timestamp: Date;
  source: string;
  context: string;
  additionalInfo: Record<string, any>;
}

export interface CommentCreatedEvent {
  commentId: number;
  loanId: number;
  loanCaseId: string;
  debtorId: number;
  userId: number;
  comment: string;
  uploadId: number | null;
  loanStatusId: number;
  shouldUpdateLastActivity: boolean;
  userRoleName: string;
}

export interface LoanStatusUpdatedEvent {
  loanId: number;
  loanCaseId: string;
  debtorId: number;
  oldStatusId: number;
  newStatusId: number;
  newStatusName: string;
  userId: number;
  comment: string | null;
  shouldUpdateAllLoans: boolean;
  shouldUpdateLastActivity: boolean;
  commitmentId: number | null;
  debtorLoans: Array<{ id: number; statusId: number; publicId: string }>;
}

export interface ChargeCreatedEvent {
  chargeId: number;
  loanId: number;
  chargeTypeTitle: string;
  amount: number;
  isLegalCharge: boolean;
  isOtherFee: boolean;
  sourceType: string;
  componentType: string;
  oldBalances: {
    principal: number;
    interest: number;
    penalty: number;
    otherFee: number;
    legalCharges: number;
  };
  newBalances: {
    principal: number;
    interest: number;
    penalty: number;
    otherFee: number;
    legalCharges: number;
  };
  newCurrentDebt: number;
  newLoanRemainingId: number;
}

export interface ChargeDeletedEvent {
  chargeId: number;
  loanId: number;
  chargeTypeTitle: string;
  amount: number;
  isLegalCharge: boolean;
  isOtherFee: boolean;
  sourceType: string;
  deletionSourceType: string;
  componentType: string;
  oldBalances: {
    principal: number;
    interest: number;
    penalty: number;
    otherFee: number;
    legalCharges: number;
  };
  newBalances: {
    principal: number;
    interest: number;
    penalty: number;
    otherFee: number;
    legalCharges: number;
  };
  newCurrentDebt: number;
  newLoanRemainingId: number;
  oldAllocationDetailId: number | null;
  oldBalanceHistoryId: number | null;
}

export interface CommitteeRespondedEvent {
  committeeId: number;
  loanId: number;
  oldLoanStatusId: number;
  committeeType: string;
  userId: number;
  agreementMinAmount: number | null;
  targetUserId: number;
  targetUserRoleId: number;
  targetUserName: string;
  currentAssignmentUserId: number | null;
  currentLoanRemainingId: number;
}

export interface MonthlyTargetCreatedEvent {
  targetId: number;
  collectorId: number;
  year: number;
  month: number;
  loanIds: number[];
}

export interface MonthlyTargetUpdatedEvent {
  targetId: number;
  collectorId: number;
  year: number;
  month: number;
  loanIds: number[];
}
