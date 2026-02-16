/**
 * Parameters for processing online payment
 */
export interface ProcessOnlinePaymentParams {
  loanId: number;
  amount: number;
  txnId: string;
  channelAccountId: number;
  comment?: string;
}

/**
 * Result of processing online payment
 */
export interface ProcessOnlinePaymentResult {
  success: boolean;
  transactionId?: number;
  error?: string;
}

/**
 * Parameters for logging TBC Pay transaction
 */
export interface LogTbcPayTransactionParams {
  txnId: string;
  command: string;
  caseId?: string;
  personalId?: string;
  sum?: number;
  resultCode: number;
  resultMessage: string;
  ipAddress?: string;
  transactionId?: number;
  requestData?: string;
  responseData?: string;
}

/**
 * Result of finding loan by case ID
 */
export interface FindLoanByCaseIdResult {
  success: boolean;
  loan?: any;
  debtor?: any;
  debt?: number;
  error?: string;
}
