import type { Deal } from '../types/entities.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import { DealStage } from '../types/enums.js';

export interface StaleDealRef {
  deal: Deal;
  daysSinceContact: number;
}

/** Open deals with no last_contacted_at or older than staleDays. */
export function findStaleDeals(repo: SalesRepository, staleDays: number): StaleDealRef[] {
  const open = repo.listOpenDeals();
  const now = Date.now();
  const ms = staleDays * 86400000;
  const out: StaleDealRef[] = [];
  for (const d of open) {
    if (d.deal_stage === DealStage.closed_lost || d.deal_stage === DealStage.closed_won) continue;
    const last = d.last_contacted_at ? Date.parse(d.last_contacted_at) : 0;
    const daysSinceContact = last ? (now - last) / 86400000 : 999;
    if (!d.last_contacted_at || now - last > ms) {
      out.push({ deal: d, daysSinceContact });
    }
  }
  return out;
}
