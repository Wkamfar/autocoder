import { config } from '../config.js';
import { initSalesMode, getSalesContext } from './salesContext.js';
import { importCsvToSourcesAndProposals } from './adapters/csvImport.js';
import { ingestGmailMetadata } from './adapters/gmailMetadata.js';
import { runFirstShipFlow } from './firstShipFlow.js';
import { applyPendingPipeline } from './operations.js';

export async function runSalesCli(args: string[]): Promise<void> {
  const [cmd, ...rest] = args;
  initSalesMode();

  if (cmd === 'import-csv') {
    const path = rest[0];
    if (!path) {
      console.error('usage: nightshift sales import-csv <file.csv>');
      process.exit(2);
    }
    const { repo } = getSalesContext();
    const r = importCsvToSourcesAndProposals(repo, path, 'cli', false);
    console.log('CRMEntitySource count:', r.sources.length, 'mutations:', r.mutationIds.length);
    return;
  }

  if (cmd === 'import-gmail-meta') {
    const path = rest[0];
    if (!path) {
      console.error('usage: nightshift sales import-gmail-meta <messages.json>');
      process.exit(2);
    }
    const { repo } = getSalesContext();
    const rows = ingestGmailMetadata(repo, path, 'cli');
    console.log('ingested CRMEntitySource rows:', rows.length);
    return;
  }

  if (cmd === 'apply-pending') {
    const approver = rest[0] || 'cli';
    const ctx = getSalesContext();
    const r = applyPendingPipeline(ctx, approver);
    console.log('apply-pending done', r);
    return;
  }

  if (cmd === 'first-ship') {
    const csvPath = rest[0];
    if (!csvPath) {
      console.error('usage: nightshift sales first-ship <file.csv>');
      process.exit(2);
    }
    await runFirstShipFlow(getSalesContext(), {
      csvPath,
      staleDays: config.sales.staleFollowupDays,
      approver: 'cli',
    });
    console.log('first-ship flow complete');
    return;
  }

  console.log(`NightShift sales (v7)
usage:
  nightshift sales import-csv <file.csv>
  nightshift sales import-gmail-meta <messages.json>
  nightshift sales apply-pending [approver]
  nightshift sales first-ship <file.csv>
`);
}
