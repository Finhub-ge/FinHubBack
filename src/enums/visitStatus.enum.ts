export enum VisitStatus {
  n_a = 1,
  pending = 2,
  completed = 3,
  canceled = 4,
}

// map frontend string → enum ID
export const statusToId: Record<string, number> = {
  'n_a': VisitStatus.n_a,
  'pending': VisitStatus.pending,
  'completed': VisitStatus.completed,
  'canceled': VisitStatus.canceled,
};

export const idToStatus: Record<number, string> = Object.fromEntries(
  Object.entries(statusToId).map(([k, v]) => [v, k])
);