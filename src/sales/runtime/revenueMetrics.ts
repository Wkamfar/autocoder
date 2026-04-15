import type { SalesRepository } from '../storage/salesRepository.js';
import { ActivityType, EntityRefType } from '../types/enums.js';

/** First-class metric events (v7) — stored for dashboards / learning. */
export function recordRevenueMetric(
  repo: SalesRepository,
  metric: string,
  value: number,
  payload?: Record<string, unknown>,
  dealId?: string
): void {
  repo.insertRevenueMetricEvent(metric, value, payload, dealId);
  const t = repo.nowIso();
  repo.appendActivity({
    id: repo.newId(),
    activity_type: ActivityType.revenue_metric_recorded,
    entity_type: EntityRefType.deal,
    entity_id: dealId,
    payload: { metric, value, ...payload },
    created_at: t,
  });
}
