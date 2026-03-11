import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';

export type SortOrder = 'asc' | 'desc';

// We'll expand this list as we implement each column
export type SortableField =
  | 'caseId'           // Case ID - direct field
  | 'groupName'        // Portfolio group name - 1-level relation
  | 'portfolioSeller'  // Lender (portfolio seller name) - 2-level relation
  | 'debtorName'       // Full name (firstName + lastName) - computed field
  | 'idNumber'         // Debtor ID number - 1-level relation
  | 'clientStatus'     // Client Status (Debtor.DebtorStatus.name) - 2-level relation
  | 'collectionStatus' // Collection Status (LoanStatus.name) - 1-level relation
  | 'principal'        // Principal (latest LoanRemaining.principal) - two-query approach
  | 'interest'         // Interest (latest LoanRemaining.interest) - two-query approach
  | 'penalty'          // Penalty (latest LoanRemaining.penalty) - two-query approach
  | 'otherFee'         // Other Fees (latest LoanRemaining.otherFee) - two-query approach
  | 'legalCharges'     // Legal Charges (latest LoanRemaining.legalCharges) - two-query approach
  | 'currentDebt'      // Total Debt (latest LoanRemaining.currentDebt) - two-query approach
  | 'city'             // City (latest LoanAddress) - two-query approach
  | 'address'          // Address (latest LoanAddress) - two-query approach
  | 'collateralStatus' // Collateral Status (latest) - two-query approach
  | 'litigationStage'  // Litigation Stage (latest) - two-query approach
  | 'legalStage'       // Legal Stage (latest) - two-query approach
  | 'mark'             // Mark (latest) - two-query approach
  | 'visitStatus';     // Visit Status (latest) - two-query approach

export class LoanSortDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: [
      'caseId', 'groupName', 'portfolioSeller', 'debtorName', 'idNumber', 'clientStatus', 'collectionStatus',
      'principal', 'interest', 'penalty', 'otherFee', 'legalCharges', 'currentDebt',
      'city', 'address', 'collateralStatus', 'litigationStage', 'legalStage', 'mark', 'visitStatus'
    ],
    example: 'caseId'
  })
  @IsOptional()
  @IsIn([
    'caseId', 'groupName', 'portfolioSeller', 'debtorName', 'idNumber', 'clientStatus', 'collectionStatus',
    'principal', 'interest', 'penalty', 'otherFee', 'legalCharges', 'currentDebt',
    'city', 'address', 'collateralStatus', 'litigationStage', 'legalStage', 'mark', 'visitStatus'
  ])
  sortBy?: SortableField;

  @ApiPropertyOptional({
    description: 'Sort order (ascending or descending)',
    enum: ['asc', 'desc'],
    default: 'asc',
    example: 'asc'
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrder = 'asc';
}
