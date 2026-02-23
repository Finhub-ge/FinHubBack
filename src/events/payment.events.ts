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

export class PaymentProcessingFailedEvent {
  transactionId: number;
  step: string;
  error: string;
  timestamp: Date;
}
