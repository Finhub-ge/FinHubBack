export class PaymentTransactionCreatedEvent {
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

export class TransactionDeletedEvent {
  transactionId: number;
  loanId: number;
  amount: number;
  paymentDate: Date;
  userId: number;
  loanRemainingId: number;
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
export class PaymentProcessingFailedEvent {
  transactionId: number;
  step: string;
  error: string;
  timestamp: Date;
}
export class CommentCreatedEvent {
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

export class LoanStatusUpdatedEvent {
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