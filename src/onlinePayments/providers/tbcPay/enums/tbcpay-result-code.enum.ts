export enum TbcPayResultCode {
  SUCCESS = 0,              // Operation successful
  SERVER_TIMEOUT = 1,       // Temporary error (TBC will retry)
  INVALID_FORMAT = 4,       // Invalid account/parameter format
  ACCOUNT_NOT_FOUND = 5,    // Loan doesn't exist or personal ID mismatch
  PAYMENT_PROHIBITED = 7,   // Loan closed/can't accept payments
  DUPLICATE = 215,          // Transaction with same txn_id already processed
  INVALID_AMOUNT = 275,     // Amount <= 0 or invalid
  FATAL_ERROR = 300,        // Unknown error (TBC will retry)
}

export const TbcPayResultMessage: Record<TbcPayResultCode, string> = {
  [TbcPayResultCode.SUCCESS]: 'OK',
  [TbcPayResultCode.SERVER_TIMEOUT]: 'Temporary database error. Try again later',
  [TbcPayResultCode.INVALID_FORMAT]: 'Invalid request format',
  [TbcPayResultCode.ACCOUNT_NOT_FOUND]: 'Loan not found or personal ID mismatch',
  [TbcPayResultCode.PAYMENT_PROHIBITED]: 'Payment prohibited - loan is closed',
  [TbcPayResultCode.DUPLICATE]: 'Transaction already processed',
  [TbcPayResultCode.INVALID_AMOUNT]: 'Invalid amount',
  [TbcPayResultCode.FATAL_ERROR]: 'System error. Try again later',
};
