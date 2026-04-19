import { Logger } from '../utils/logger.js';

/**
 * Build a compact CRM snapshot for the Sales chat's system prompt.
 *
 * Lazily imports the Sales context so this module is safe to reference
 * from builds where the sales subsystem isn't initialized (local
 * worktree / thin branches). If the sales DB isn't available, returns
 * an empty string so the chat falls back to plain repo context.
 */
const log = new Logger('chat:crm-ctx');

export async function buildSalesCrmContext(): Promise<string> {
  try {
    const { getSalesContext } = await import('../sales/salesContext.js');
    const ctx = getSalesContext();
    const repo = ctx.repo;

    const accounts = repo.listAccounts();
    const contacts = repo.listContacts();
    const deals = repo.listDeals();
    const openDeals = (typeof (repo as { listOpenDeals?: () => unknown }).listOpenDeals === 'function'
      ? (repo as { listOpenDeals: () => typeof deals }).listOpenDeals()
      : deals);
    const activities = repo.listActivities();

    const lines: string[] = [];
    lines.push(`CRM snapshot:`);
    lines.push(`- accounts: ${accounts.length}`);
    lines.push(`- contacts: ${contacts.length}`);
    lines.push(`- deals total: ${deals.length}, open: ${openDeals.length}`);
    lines.push(`- activities logged: ${activities.length}`);
    lines.push('');

    // Top open deals by recency (updated_at desc). Cap 20 rows.
    const topDeals = [...openDeals]
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, 20);
    if (topDeals.length > 0) {
      lines.push('Top open deals (most recently updated):');
      for (const d of topDeals) {
        const acct = accounts.find((a) => a.id === d.account_id);
        const acctName = acct?.name ?? d.account_id;
        const stale = d.stale_reason ? ` [stale: ${d.stale_reason}]` : '';
        const last = d.last_contacted_at ? ` last_contact=${d.last_contacted_at.slice(0, 10)}` : '';
        lines.push(
          `- ${d.id}  ${acctName}  stage=${d.deal_stage}  mode=${d.assigned_mode}${last}${stale}`
        );
      }
      lines.push('');
    }

    // Last 10 activities, newest first.
    const recent = [...activities]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 10);
    if (recent.length > 0) {
      lines.push('Most recent activities:');
      for (const a of recent) {
        const when = (a.created_at ?? '').slice(0, 16).replace('T', ' ');
        const ref = a.entity_type && a.entity_id ? `${a.entity_type}:${a.entity_id}` : '—';
        lines.push(`- ${when}  ${a.activity_type}  ${ref}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    const msg = (err as Error).message || 'unknown';
    log.warn(`CRM snapshot unavailable: ${msg.slice(0, 120)}`);
    return '';
  }
}
