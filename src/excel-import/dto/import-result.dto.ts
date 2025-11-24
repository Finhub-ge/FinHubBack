export interface ImportResultDto {
  success: boolean;
  message: string;
  summary: {
    portfoliosProcessed: number;
    debtorsCreated: number;
    debtorsUpdated: number;
    loansCreated: number;
    loansUpdated: number;
    transactionsCreated: number;
    guarantorsCreated: number;
    assignmentsCreated: number;
    attributesCreated: number;
  };
  errors?: Array<{
    sheet: string;
    row: number;
    field?: string;
    message: string;
  }>;
}
