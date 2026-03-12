import { SortableField, SortOrder } from 'src/loan/dto/loanSort.dto';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Maps sortable fields to Prisma orderBy configuration
 * Returns orderBy clause for database-level sorting
 * Returns null for fields that require post-query sorting
 */
export function buildDatabaseOrderBy(
  sortBy?: SortableField,
  sortOrder: SortOrder = 'asc'
): any {
  // If no sortBy specified, use default
  if (!sortBy) {
    return { lastActivite: 'asc' };
  }

  const order = sortOrder;

  switch (sortBy) {
    // ===== DIRECT FIELDS =====
    case 'caseId':
      return { caseId: order };

    case 'actDay':
      return { lastActivite: order };

    // ===== 1-LEVEL RELATIONS =====
    case 'groupName':
      return { PortfolioCaseGroup: { groupName: order } };

    case 'idNumber':
      return { Debtor: { idNumber: order } };

    case 'collectionStatus':
      return { LoanStatus: { name: order } };

    // ===== 2-LEVEL RELATIONS =====
    case 'portfolioSeller':
      return { Portfolio: { portfolioSeller: { name: order } } };

    case 'clientStatus':
      return { Debtor: { DebtorStatus: { name: order } } };

    // ===== COMPUTED FIELDS (Multi-field sort) =====
    case 'debtorName':
      // Sort by firstName first, then lastName
      return [
        { Debtor: { firstName: order } },
        { Debtor: { lastName: order } }
      ];

    // ===== BATCH-LOADED FIELDS (Two-query approach) =====
    case 'principal':
    case 'interest':
    case 'penalty':
    case 'otherFee':
    case 'legalCharges':
    case 'currentDebt':
    case 'statusDate':
    case 'city':
    case 'address':
    case 'collateralStatus':
    case 'litigationStage':
    case 'legalStage':
    case 'mark':
    case 'visitStatus':
    case 'collector':
    case 'collAssignDate':
    case 'lawyer':
    case 'lawAssignDate':
    case 'juniorLawyer':
    case 'execLawyer':
    case 'lastPay':
      // These use two-query approach for accurate cross-page sorting
      // Return null to trigger two-query flow
      return null;

    // Default fallback
    default:
      return { lastActivite: 'asc' };
  }
}

/**
 * Determines if a field requires post-query sorting (in-memory)
 * Returns true for batch-loaded fields that aren't available at query time
 */
export function requiresPostQuerySorting(sortBy?: SortableField): boolean {
  if (!sortBy) return false;

  // Batch-loaded fields that use two-query approach for accurate sorting
  // Query 1: Get all loan IDs with sort field
  // Sort all results
  // Query 2: Get full data for paginated IDs
  const postQueryFields: SortableField[] = [
    'principal',         // Latest LoanRemaining.principal
    'interest',          // Latest LoanRemaining.interest
    'penalty',           // Latest LoanRemaining.penalty
    'otherFee',          // Latest LoanRemaining.otherFee
    'legalCharges',      // Latest LoanRemaining.legalCharges
    'currentDebt',       // Latest LoanRemaining.currentDebt
    'statusDate',        // Latest LoanStatusHistory.createdAt
    'city',              // Latest LoanAddress.City.city
    'address',           // Latest LoanAddress.address
    'collateralStatus',  // Latest LoanCollateralStatus
    'litigationStage',   // Latest LoanLitigationStage
    'legalStage',        // Latest LoanLegalStage
    'mark',              // Latest LoanMarks
    'visitStatus',       // Latest LoanVisit.status
    'collector',         // Active LoanAssignment.User (Role = collector)
    'collAssignDate',    // Active LoanAssignment.assignedAt (Role = collector)
    'lawyer',            // Active LoanAssignment.User (Role = lawyer)
    'lawAssignDate',     // Active LoanAssignment.assignedAt (Role = lawyer)
    'juniorLawyer',      // Active LoanAssignment.User (Role = junior_lawyer)
    'execLawyer',        // Active LoanAssignment.User (Role = execution_lawyer)
    'lastPay',           // Latest Transaction.paymentDate
  ];

  return postQueryFields.includes(sortBy);
}

/**
 * Extracts sortable value from enriched loan object
 * Used for in-memory sorting of batch-loaded fields
 */
export function extractSortValue(loan: any, sortBy: SortableField): any {
  switch (sortBy) {
    // Direct fields
    case 'caseId':
      return loan.caseId || '';

    case 'actDay':
      return loan.actDays ?? 0;

    // 1-level relations
    case 'groupName':
      return loan.PortfolioCaseGroup?.groupName || '';

    case 'idNumber':
      return loan.Debtor?.idNumber || '';

    case 'collectionStatus':
      return loan.LoanStatus?.name || '';

    // 2-level relations
    case 'portfolioSeller':
      return loan.Portfolio?.portfolioSeller?.name || '';

    case 'clientStatus':
      return loan.Debtor?.DebtorStatus?.name || '';

    // Computed fields
    case 'debtorName':
      // Combine firstName and lastName for sorting
      const firstName = loan.Debtor?.firstName || '';
      const lastName = loan.Debtor?.lastName || '';
      return `${firstName} ${lastName}`.trim();

    // Batch-loaded fields (from minimal query or batch loading)
    case 'principal':
      return loan.LoanRemaining?.[0]?.principal ?? 0;

    case 'interest':
      return loan.LoanRemaining?.[0]?.interest ?? 0;

    case 'penalty':
      return loan.LoanRemaining?.[0]?.penalty ?? 0;

    case 'otherFee':
      return loan.LoanRemaining?.[0]?.otherFee ?? 0;

    case 'legalCharges':
      return loan.LoanRemaining?.[0]?.legalCharges ?? 0;

    case 'currentDebt':
      return loan.LoanRemaining?.[0]?.currentDebt ?? 0;

    case 'statusDate':
      return loan.LoanStatusHistory?.[0]?.createdAt || null;

    case 'city':
      return loan.LoanAddress?.[0]?.City?.city || '';

    case 'address':
      return loan.LoanAddress?.[0]?.address || '';

    case 'collateralStatus':
      return loan.LoanCollateralStatus?.[0]?.CollateralStatus?.title || '';

    case 'litigationStage':
      return loan.LoanLitigationStage?.[0]?.LitigationStage?.title || '';

    case 'legalStage':
      return loan.LoanLegalStage?.[0]?.LegalStage?.title || '';

    case 'mark':
      return loan.LoanMarks?.[0]?.Marks?.title || '';

    case 'visitStatus':
      return loan.LoanVisit?.[0]?.status || '';

    case 'collector':
      const collectorFirstName = loan.LoanAssignment?.[0]?.User?.firstName || '';
      const collectorLastName = loan.LoanAssignment?.[0]?.User?.lastName || '';
      return `${collectorFirstName} ${collectorLastName}`.trim();

    case 'collAssignDate':
      return loan.LoanAssignment?.[0]?.assignedAt || null;

    case 'lawyer':
      const lawyerFirstName = loan.LoanAssignment?.[0]?.User?.firstName || '';
      const lawyerLastName = loan.LoanAssignment?.[0]?.User?.lastName || '';
      return `${lawyerFirstName} ${lawyerLastName}`.trim();

    case 'lawAssignDate':
      return loan.LoanAssignment?.[0]?.assignedAt || null;

    case 'juniorLawyer':
      const juniorFirstName = loan.LoanAssignment?.[0]?.User?.firstName || '';
      const juniorLastName = loan.LoanAssignment?.[0]?.User?.lastName || '';
      return `${juniorFirstName} ${juniorLastName}`.trim();

    case 'execLawyer':
      const execFirstName = loan.LoanAssignment?.[0]?.User?.firstName || '';
      const execLastName = loan.LoanAssignment?.[0]?.User?.lastName || '';
      return `${execFirstName} ${execLastName}`.trim();

    case 'lastPay':
      return loan.Transaction?.[0]?.paymentDate || null;

    default:
      return null;
  }
}

/**
 * Sorts loans array in-memory
 * Used for fields that can't be sorted at database level
 */
export function sortLoansInMemory(
  loans: any[],
  sortBy: SortableField,
  sortOrder: SortOrder = 'asc'
): any[] {
  return loans.sort((a, b) => {
    const aVal = extractSortValue(a, sortBy);
    const bVal = extractSortValue(b, sortBy);

    // Handle null/undefined values (put them at the end)
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Handle dates
    if (aVal instanceof Date && bVal instanceof Date) {
      const comparison = aVal.getTime() - bVal.getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    }

    // Handle numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Handle strings (case-insensitive)
    const comparison = String(aVal).localeCompare(String(bVal), undefined, {
      sensitivity: 'base',
      numeric: true
    });
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

/**
 * Two-query approach for batch-loaded fields
 * 1. Fetch ALL loans with minimal data (just ID + sort field)
 * 2. Sort all results in memory
 * 3. Return paginated loan IDs
 *
 * This ensures accurate sorting across ALL pages, not just current page
 */
export async function getSortedLoanIdsForBatchFields(
  prisma: PrismaService,
  where: any,
  sortBy: SortableField,
  sortOrder: SortOrder,
  page: number,
  limit: number
): Promise<{ loanIds: number[]; totalCount: number } | null> {
  // Only use this approach for batch-loaded fields
  if (!requiresPostQuerySorting(sortBy)) {
    return null;
  }

  // Build minimal select based on sort field
  const selectConfig = buildMinimalSelectForSort(sortBy);

  // 1. Fetch ALL loans with minimal data (just what we need to sort)
  const allLoansMinimal = await prisma.loan.findMany({
    where,
    select: selectConfig,
  });

  const totalCount = allLoansMinimal.length;

  // 2. Sort ALL loans in memory
  const sortedLoans = sortLoansInMemory(allLoansMinimal, sortBy, sortOrder);

  // 3. Paginate - extract IDs for current page
  const skip = (page - 1) * limit;
  const paginatedLoans = sortedLoans.slice(skip, skip + limit);
  const loanIds = paginatedLoans.map(loan => loan.id);

  return { loanIds, totalCount };
}

/**
 * Builds minimal select configuration for lightweight sorting query
 * Only selects ID + the fields needed for sorting
 */
function buildMinimalSelectForSort(sortBy: SortableField): any {
  const baseSelect = { id: true };

  switch (sortBy) {
    case 'principal':
    case 'interest':
    case 'penalty':
    case 'otherFee':
    case 'legalCharges':
    case 'currentDebt':
      return {
        ...baseSelect,
        LoanRemaining: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            principal: true,
            interest: true,
            penalty: true,
            otherFee: true,
            legalCharges: true,
            currentDebt: true
          }
        }
      };

    case 'statusDate':
      return {
        ...baseSelect,
        LoanStatusHistory: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            createdAt: true
          }
        }
      };

    case 'city':
    case 'address':
      return {
        ...baseSelect,
        LoanAddress: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            address: true,
            City: { select: { city: true } }
          }
        }
      };

    case 'collateralStatus':
      return {
        ...baseSelect,
        LoanCollateralStatus: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            CollateralStatus: { select: { title: true } }
          }
        }
      };

    case 'litigationStage':
      return {
        ...baseSelect,
        LoanLitigationStage: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            LitigationStage: { select: { title: true } }
          }
        }
      };

    case 'legalStage':
      return {
        ...baseSelect,
        LoanLegalStage: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            LegalStage: { select: { title: true } }
          }
        }
      };

    case 'mark':
      return {
        ...baseSelect,
        LoanMarks: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            Marks: { select: { title: true } }
          }
        }
      };

    case 'visitStatus':
      return {
        ...baseSelect,
        LoanVisit: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            status: true
          }
        }
      };

    case 'collector':
    case 'collAssignDate':
      return {
        ...baseSelect,
        LoanAssignment: {
          where: {
            deletedAt: null,
            isActive: true,
            Role: { name: 'collector' }
          },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
          select: {
            assignedAt: true,
            User: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      };

    case 'lawyer':
    case 'lawAssignDate':
      return {
        ...baseSelect,
        LoanAssignment: {
          where: {
            deletedAt: null,
            isActive: true,
            Role: { name: 'lawyer' }
          },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
          select: {
            assignedAt: true,
            User: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      };

    case 'juniorLawyer':
      return {
        ...baseSelect,
        LoanAssignment: {
          where: {
            deletedAt: null,
            isActive: true,
            Role: { name: 'junior_lawyer' }
          },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
          select: {
            User: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      };

    case 'execLawyer':
      return {
        ...baseSelect,
        LoanAssignment: {
          where: {
            deletedAt: null,
            isActive: true,
            Role: { name: 'execution_lawyer' }
          },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
          select: {
            User: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      };

    case 'lastPay':
      return {
        ...baseSelect,
        Transaction: {
          where: {
            deleted: 0,
            paymentDate: { not: null }
          },
          orderBy: { paymentDate: 'desc' as const },
          take: 1,
          select: {
            paymentDate: true
          }
        }
      };

    default:
      return baseSelect;
  }
}
