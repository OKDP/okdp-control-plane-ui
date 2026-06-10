// Status presentation helpers shared by the secret store and external
// secret lists (their status models differ only in the "healthy" value:
// 'Ready' for stores, 'Synced' for external secrets).

export type StatusSeverity = 'success' | 'danger' | 'warning' | 'info';

export function statusSeverity(status: string, successStatus: string): StatusSeverity {
  switch (status) {
    case successStatus:
      return 'success';
    case 'Error':
      return 'danger';
    case 'Pending':
      return 'warning';
    default:
      return 'info';
  }
}

interface ConditionLike {
  status: string;
}

export function getConditionIcon(condition: ConditionLike): string {
  return condition.status === 'True' ? 'pi pi-check-circle' : 'pi pi-times-circle';
}

export function getConditionClass(condition: ConditionLike): string {
  return condition.status === 'True' ? 'condition-ok' : 'condition-error';
}
