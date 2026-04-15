/**
 * Phase 2: live CRM read-through as SalesWorldFile (same mapping as crm-export-world).
 * @see docs/CRM_SALES_OS_UNIFICATION.md §5.2
 */
import type { SalesRepository } from '../storage/salesRepository.js';
import type { SalesWorldFile } from './types.js';
import { buildCrmWorldExportRoot } from './crmWorldExport.js';

/** Build an in-memory world snapshot from SQLite (provenance: crm_backed). */
export function salesWorldFromCrmRepository(repo: SalesRepository, exportedAt?: string): SalesWorldFile {
  const root = buildCrmWorldExportRoot(repo, exportedAt ?? new Date().toISOString());
  return {
    accounts: root.accounts,
    contacts: root.contacts,
    deals: root.deals,
    activities: root.activities,
    suppression_flags: root.suppression_flags,
  };
}

/** Named alias for doc alignment (JsonWorldDataSource = file-backed — see fileWorldStore.loadSalesWorld). */
export const CrmWorldDataSource = {
  build: salesWorldFromCrmRepository,
};
