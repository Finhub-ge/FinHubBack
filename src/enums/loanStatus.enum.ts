// 1) Enum of all known status IDs (from your list)
export enum LoanStatusId {
  NEW = 1,
  COMMUNICATION = 2,
  AGREEMENT = 3,
  PROPOSAL_OFFERED_PHONE = 4,
  PROPOSAL_OFFERED_FACEBOOK = 5,
  PROPOSAL_OFFERED_OFFICE = 6,
  PROPOSAL_OFFERED_VISITED = 7,
  UNREACHABLE = 8,
  RESTRUCTURED = 9,
  HOPELESS_DEAD = 10,
  HOPELESS_EXECUTION = 11,
  CLOSED_PAID = 12,
  CLOSED_OTHER = 13,
  AGREEMENT_CANCELED = 14,
  CHANGE_USER = 15,
  USER_FETCH_CASE = 16,
  REFUSE_TO_PAY = 17,
  NEW_REMINDER = 18,
  CONTACT_DELETED = 19,
  REMINDER_DONE = 20,
  NEW_PAYMENT = 21,
  LEGAL_STAGE_UPDATED = 22,
  CASE_STATUS_UPDATED = 23,
  CONTACT_UPDATED = 24,
  MAIN_PHONE_UPDATED = 25,
  PROMISED_TO_PAY = 26,
  CLOSED_RETURNING_COURT_FEE = 27,
  ADD_CASE_ATTRIBUTE = 28,
  // 29 missing
  REMOVE_LAWYER = 30,
  MARK_ADDED = 31,
  MARK_REMOVED = 32,
  NEW_CHARGE = 33,
  NEW_COMMENT = 34,
  COURIER_ADDED = 35,
  CLIENT_STATUS_CHANGED = 36,
  ASSIGN_LAWYER = 37,
  // 38 missing
  ASSIGN_COLLECTOR = 39,
  CHANGE_PORTFOLIO = 40,
  FAILED_PROMISE = 41,
  REMOVE_HIDE_LAWYER = 42,
  RESTORE_CASE = 43,
  CHANGE_COLLECTION_STATUS = 44,
}

// 2) Logical groups (edit arrays to suit your business rules)
export const LoanStatusGroups = {
  // Primary "closed" group (treated as closed for filtering)
  CLOSED: [
    LoanStatusId.CLOSED_PAID,
    LoanStatusId.CLOSED_OTHER,
    LoanStatusId.CLOSED_RETURNING_COURT_FEE,
  ],

  // Hopeless / terminal but distinct from closed
  HOPELESS: [
    LoanStatusId.HOPELESS_DEAD,
    LoanStatusId.HOPELESS_EXECUTION,
  ],

  // Active / workflow statuses
  ACTIVE: [
    LoanStatusId.NEW,
    LoanStatusId.COMMUNICATION,
    LoanStatusId.AGREEMENT,
    LoanStatusId.RESTRUCTURED,
    LoanStatusId.PROMISED_TO_PAY,
    LoanStatusId.REFUSE_TO_PAY,
    LoanStatusId.UNREACHABLE,
    LoanStatusId.FAILED_PROMISE,
  ],

  // Proposal / offer flow
  PROPOSAL: [
    LoanStatusId.PROPOSAL_OFFERED_PHONE,
    LoanStatusId.PROPOSAL_OFFERED_FACEBOOK,
    LoanStatusId.PROPOSAL_OFFERED_OFFICE,
    LoanStatusId.PROPOSAL_OFFERED_VISITED,
  ],

  // Payment / charge related
  PAYMENT: [
    LoanStatusId.NEW_PAYMENT,
    LoanStatusId.NEW_CHARGE,
    LoanStatusId.PROMISED_TO_PAY,
    LoanStatusId.FAILED_PROMISE,
  ],

  // Reminders & contact updates
  REMINDERS_AND_CONTACT: [
    LoanStatusId.NEW_REMINDER,
    LoanStatusId.REMINDER_DONE,
    LoanStatusId.CONTACT_UPDATED,
    LoanStatusId.MAIN_PHONE_UPDATED,
    LoanStatusId.CONTACT_DELETED,
  ],

  // Legal / case updates
  LEGAL_AND_CASE: [
    LoanStatusId.LEGAL_STAGE_UPDATED,
    LoanStatusId.CASE_STATUS_UPDATED,
    LoanStatusId.CLOSED_RETURNING_COURT_FEE, // also in CLOSED, ok if duplicated for convenience
    LoanStatusId.RESTORE_CASE,
  ],

  // Assignment / user / admin actions
  ASSIGNMENT_AND_ADMIN: [
    LoanStatusId.CHANGE_USER,
    LoanStatusId.USER_FETCH_CASE,
    LoanStatusId.CHANGE_PORTFOLIO,
    LoanStatusId.ASSIGN_LAWYER,
    LoanStatusId.ASSIGN_COLLECTOR,
    LoanStatusId.REMOVE_LAWYER,
    LoanStatusId.REMOVE_HIDE_LAWYER,
  ],

  // Marks & metadata
  MARKS_AND_META: [
    LoanStatusId.MARK_ADDED,
    LoanStatusId.MARK_REMOVED,
    LoanStatusId.ADD_CASE_ATTRIBUTE,
  ],

  // Misc / communication / notes
  MISC: [
    LoanStatusId.NEW_COMMENT,
    LoanStatusId.COURIER_ADDED,
    LoanStatusId.CLIENT_STATUS_CHANGED,
  ],
} as const;

// 3) Type for valid status group keys (helps TypeScript autocomplete)
export type StatusGroup = keyof typeof LoanStatusGroups;

// 4) Helper: get array of ids for a group (returns number[])
export function getStatusIdsForGroup(group: StatusGroup): number[] {
  return Array.from(LoanStatusGroups[group]);
}

export const statusNameMap: Record<number, string> = Object.fromEntries(
  Object.entries(LoanStatusId)
    .filter(([key, value]) => typeof value === 'number') // only number values
    .map(([key, value]) => [value as number, key])
);