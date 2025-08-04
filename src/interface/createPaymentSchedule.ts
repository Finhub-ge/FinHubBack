export interface CreatePaymentSchedule {
  commitmentId: number;
  paymentDate: string; 
  amount: number;
  numberOfMonths: number;
}