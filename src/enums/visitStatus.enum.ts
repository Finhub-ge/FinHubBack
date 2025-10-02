export enum VisitStatus {
  n_a = 1,
  pending = 2,
  complete = 3,
  canceled = 4,
}

// map frontend string → enum ID
export const statusToId: Record<string, number> = {
  'n_a': VisitStatus.n_a,
  'pending': VisitStatus.pending,
  'complete': VisitStatus.complete,
  'canceled': VisitStatus.canceled,
};