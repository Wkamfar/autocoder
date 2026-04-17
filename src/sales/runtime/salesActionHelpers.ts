import type { SalesRepository } from '../storage/salesRepository.js';
import type { SalesAction } from '../types/entities.js';
import { SalesActionStatus, HumanGateReason } from '../types/enums.js';

export function approveSalesAction(repo: SalesRepository, id: string, by: string): SalesAction | undefined {
  const a = repo.getSalesAction(id);
  if (!a) return undefined;
  const t = repo.nowIso();
  const next: SalesAction = {
    ...a,
    status: SalesActionStatus.approved,
    approved_by: by,
    approved_at: t,
    updated_at: t,
  };
  repo.updateSalesAction(next);
  return repo.getSalesAction(id);
}

export function markSalesActionExecuting(repo: SalesRepository, id: string): void {
  const a = repo.getSalesAction(id);
  if (!a) return;
  const t = repo.nowIso();
  repo.updateSalesAction({
    ...a,
    status: SalesActionStatus.executing,
    updated_at: t,
  });
}
