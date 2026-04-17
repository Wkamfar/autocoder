import type { SalesRepository } from '../storage/salesRepository.js';
import type { CustomerContextSnapshot } from '../types/entities.js';
import { EntityRefType } from '../types/enums.js';

/**
 * Read-only planning snapshot from canonical CRM only.
 * Invariant: RUNTIME_READS_CANONICAL_ONLY
 */
export function buildCustomerContext(
  repo: SalesRepository,
  accountId: string,
  activityLimit = 50
): CustomerContextSnapshot {
  const account = repo.getAccount(accountId);
  const contacts = account ? repo.listContactsForAccount(accountId) : [];
  const deals = repo.listDealsForAccount(accountId);
  const edges = repo.listEdgesForEntity(EntityRefType.account, accountId);
  const recent = repo.listRecentActivities(activityLimit).filter(
    (a) => a.entity_id === accountId || deals.some((d) => d.id === a.entity_id)
  );
  return {
    built_at: new Date().toISOString(),
    account,
    contacts,
    deals,
    relationship_edges: edges,
    recent_activities: recent,
  };
}
