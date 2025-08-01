export interface CreatePaymentCommitment {
  loanId: number;
  amount: number;
  paymentDate: string;
  userId: number;
  type: 'agreement' | 'promise';
  comment?: string;

}