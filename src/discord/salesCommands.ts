import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Message } from 'discord.js';
import { config } from '../config.js';
import { initSalesMode, getSalesContext } from '../sales/salesContext.js';
import { importCsvToSourcesAndProposals } from '../sales/adapters/csvImport.js';
import { ingestGmailMetadata } from '../sales/adapters/gmailMetadata.js';
import { runFirstShipFlow } from '../sales/firstShipFlow.js';
import { applyPendingPipeline } from '../sales/operations.js';

export const SALES_COMMAND_HELP = `NightShift sales (v7 — canonical CRM + CRMMutation + SalesAction)
  !ns sales help              this text
  !ns sales status            SQLite counts (SALES_DB_PATH)
  !ns sales import-csv        attach leads.csv (headers: company,domain,email,name)
  !ns sales import-gmail-meta attach messages.json (Gmail metadata JSON)
  !ns sales apply-pending     approve+apply mutations, link contacts, create deals
  !ns sales first-ship        attach CSV — full E2E (import→apply→stale→send→classify→stage)

Requires attachment for import* and first-ship. Restrict with DISCORD_SALES_CHANNEL_ID + DISCORD_OWNER_ID.`;

export function salesCommandAllowed(msg: Message): { ok: boolean; reason?: 'wrong_channel' | 'not_owner' } {
  if (config.discord.salesChannelId && msg.channelId !== config.discord.salesChannelId) {
    return { ok: false, reason: 'wrong_channel' };
  }
  if (
    config.discord.salesRequireOwner &&
    config.discord.ownerId &&
    msg.author.id !== config.discord.ownerId
  ) {
    return { ok: false, reason: 'not_owner' };
  }
  return { ok: true };
}

async function downloadAttachment(msg: Message, ext: string): Promise<string | null> {
  const a = msg.attachments.first();
  if (!a?.name?.toLowerCase().endsWith(ext)) return null;
  const res = await fetch(a.url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const safeName = a.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(os.tmpdir(), `ns-sales-${msg.id}-${safeName}`);
  await fs.writeFile(filePath, buf);
  return filePath;
}

export async function handleSalesCommand(msg: Message, sub: string, _args: string): Promise<string> {
  const gate = salesCommandAllowed(msg);
  if (!gate.ok) {
    if (gate.reason === 'wrong_channel') {
      return 'Sales commands are limited to the configured sales channel. Set `DISCORD_SALES_CHANNEL_ID` to this channel id, or clear it to allow any channel.';
    }
    return 'You are not authorized to run sales commands (check `DISCORD_OWNER_ID` / `DISCORD_SALES_REQUIRE_OWNER`).';
  }

  initSalesMode();
  const ctx = getSalesContext();
  const approver = `discord:${msg.author.id}`;

  switch (sub) {
    case 'help':
      return '```\n' + SALES_COMMAND_HELP + '\n```';

    case 'status': {
      const s = ctx.repo.getCanonicalStats();
      return (
        '```\n' +
        [
          `db: ${config.sales.dbPath}`,
          `accounts: ${s.accounts}  contacts: ${s.contacts}  deals: ${s.deals} (open: ${s.open_deals})`,
          `mutations proposed: ${s.crm_mutations_proposed}  applied: ${s.crm_mutations_applied}`,
          `sales_actions: ${s.sales_actions} (completed: ${s.sales_actions_completed})`,
          `activities: ${s.activities}  sources: ${s.crm_entity_sources}`,
        ].join('\n') +
        '\n```'
      );
    }

    case 'import-csv': {
      const p = await downloadAttachment(msg, '.csv');
      if (!p) return 'Attach one **.csv** with headers `company,domain,email,name`.';
      try {
        const r = importCsvToSourcesAndProposals(ctx.repo, p, `discord:${msg.channelId}`, false);
        return `Imported **${r.sources.length}** sources, **${r.mutationIds.length}** mutation proposals. Run \`!ns sales apply-pending\`.`;
      } finally {
        await fs.unlink(p).catch(() => {});
      }
    }

    case 'import-gmail-meta': {
      const p = await downloadAttachment(msg, '.json');
      if (!p) return 'Attach one **.json** (Gmail metadata export).';
      try {
        const rows = ingestGmailMetadata(ctx.repo, p, `discord:${msg.channelId}`);
        return `Ingested **${rows.length}** \`CRMEntitySource\` rows.`;
      } finally {
        await fs.unlink(p).catch(() => {});
      }
    }

    case 'apply-pending': {
      const r = applyPendingPipeline(ctx, approver);
      return (
        '```\n' +
        `apply-pending: mutations=${r.mutationsApplied} link=${r.linkMutations} deals=${r.dealMutations}` +
        '\n```'
      );
    }

    case 'first-ship': {
      const p = await downloadAttachment(msg, '.csv');
      if (!p) return 'Attach one **.csv** to run the full first-ship vertical slice.';
      try {
        await runFirstShipFlow(ctx, {
          csvPath: p,
          staleDays: config.sales.staleFollowupDays,
          approver,
        });
        const st = ctx.repo.getCanonicalStats();
        return (
          '**First-ship complete.**\n```\n' +
          [
            `accounts: ${st.accounts}`,
            `contacts: ${st.contacts}`,
            `deals: ${st.deals}`,
            `sales_actions completed: ${st.sales_actions_completed}`,
          ].join('\n') +
          '\n```'
        );
      } finally {
        await fs.unlink(p).catch(() => {});
      }
    }

    default:
      return `Unknown \`!ns sales\` subcommand \`${sub}\`. Try \`!ns sales help\`.`;
  }
}
