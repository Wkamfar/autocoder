import type { DossierPack, DossierTiming } from '../pairDebate/types.js';
import type {
  SalesAccount,
  SalesActivity,
  SalesContact,
  SalesDeal,
  SalesWorldFile,
} from './types.js';
import {
  activitiesForScope,
  contactsForAccount,
  dealsForAccount,
} from './fileWorldStore.js';

/**
 * Narrative CRM context string (truth layer body) from resolved entities.
 */
export function buildCustomerContext(params: {
  world: SalesWorldFile;
  account: SalesAccount;
  deals: SalesDeal[];
  contacts: SalesContact[];
  activities: SalesActivity[];
  timing: DossierTiming;
  label: string;
}): DossierPack {
  const { world, account, deals, contacts, activities, timing, label } = params;
  const lines: string[] = [];
  lines.push(`# ${label}`);
  lines.push('');
  lines.push('## Account');
  lines.push(`- Name: ${account.name}`);
  lines.push(`- Id: ${account.id}`);
  if (account.owner) lines.push(`- Owner: ${account.owner}`);
  if (account.notes) lines.push(`- Notes: ${account.notes}`);
  lines.push('');
  if (world.suppression_flags?.length) {
    lines.push('## Suppression / consent');
    for (const s of world.suppression_flags) lines.push(`- ${s}`);
    lines.push('');
  }
  lines.push('## Timing');
  lines.push(`- decision_deadline: ${timing.decision_deadline ?? 'unknown'}`);
  lines.push(`- timing_sensitivity: ${timing.timing_sensitivity}`);
  lines.push('');
  lines.push('## Deals');
  if (deals.length === 0) lines.push('- (none)');
  for (const d of deals) {
    const amt =
      d.value_cents != null
        ? `${(d.value_cents / 100).toLocaleString('en-US', { style: 'currency', currency: d.currency || 'USD' })}`
        : 'unknown';
    lines.push(`- **${d.name ?? d.id}** (${d.id})`);
    lines.push(`  - stage: ${d.stage}`);
    lines.push(`  - value: ${amt}`);
    if (d.last_touch_days_ago != null) {
      lines.push(`  - last_touch_days_ago: ${d.last_touch_days_ago}`);
    }
    if (d.objections_raised?.length) {
      lines.push(`  - objections: ${d.objections_raised.join('; ')}`);
    }
    if (d.next_planned_action) {
      lines.push(`  - next_planned_action (CRM): ${d.next_planned_action}`);
    }
  }
  lines.push('');
  lines.push('## Contacts');
  if (contacts.length === 0) lines.push('- (none)');
  for (const c of contacts) {
    lines.push(`- ${c.name} (${c.id})${c.email ? ` <${c.email}>` : ''}${c.role ? ` — ${c.role}` : ''}`);
  }
  lines.push('');
  lines.push('## Recent activity');
  const sorted = [...activities].sort((a, b) => a.at.localeCompare(b.at));
  const tail = sorted.slice(-12);
  if (tail.length === 0) lines.push('- (none logged)');
  for (const a of tail) {
    lines.push(`- ${a.at} [${a.type}] ${a.summary}`);
  }

  const body = lines.join('\n');

  let strategy_context: DossierPack['strategy_context'];
  if (deals.length === 1) {
    const d0 = deals[0];
    const usd = d0.value_cents != null ? d0.value_cents / 100 : undefined;
    strategy_context = { deal_stage: d0.stage, deal_value_usd: usd };
  }

  return {
    scope_label: label,
    body,
    timing,
    strategy_context,
  };
}

export function resolveContextForDeal(world: SalesWorldFile, dealId: string): DossierPack {
  const deal = world.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error(`deal not found: ${dealId}`);
  const account = world.accounts.find((a) => a.id === deal.account_id);
  if (!account) throw new Error(`account not found for deal: ${deal.account_id}`);
  const contacts = contactsForAccount(world, account.id);
  const activities = activitiesForScope(world, account.id, deal.id);
  const timing: DossierTiming = {
    decision_deadline: deal.decision_deadline ?? null,
    timing_sensitivity: deal.timing_sensitivity ?? 'medium',
  };
  return buildCustomerContext({
    world,
    account,
    deals: [deal],
    contacts,
    activities,
    timing,
    label: `${account.name} — deal ${deal.name ?? dealId}`,
  });
}

export function resolveContextForAccount(world: SalesWorldFile, accountId: string): DossierPack {
  const account = world.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`account not found: ${accountId}`);
  const deals = dealsForAccount(world, accountId);
  const contacts = contactsForAccount(world, accountId);
  const activities = activitiesForScope(world, accountId);
  const primary = deals[0];
  const timing: DossierTiming = {
    decision_deadline: primary?.decision_deadline ?? null,
    timing_sensitivity: primary?.timing_sensitivity ?? 'medium',
  };
  return buildCustomerContext({
    world,
    account,
    deals,
    contacts,
    activities,
    timing,
    label: `${account.name} — account scope`,
  });
}

export function resolveContextForContact(world: SalesWorldFile, contactId: string): DossierPack {
  const contact = world.contacts.find((c) => c.id === contactId);
  if (!contact) throw new Error(`contact not found: ${contactId}`);
  const account = world.accounts.find((a) => a.id === contact.account_id);
  if (!account) throw new Error(`account not found: ${contact.account_id}`);
  const deals = dealsForAccount(world, account.id);
  const contacts = contactsForAccount(world, account.id);
  const activities = activitiesForScope(world, account.id);
  const primary = deals[0];
  const timing: DossierTiming = {
    decision_deadline: primary?.decision_deadline ?? null,
    timing_sensitivity: primary?.timing_sensitivity ?? 'medium',
  };
  return buildCustomerContext({
    world,
    account,
    deals,
    contacts,
    activities,
    timing,
    label: `${account.name} / ${contact.name} — contact scope`,
  });
}
