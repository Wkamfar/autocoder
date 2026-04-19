import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateSalesActionPolicy,
  appendSalesActionAudit,
  SALES_ACTION_SCHEMA_VERSION,
} from '../../sales/execution/index.js';
import type { SalesAction, SalesActionPolicyContext } from '../../sales/execution/types.js';

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  return JSON.parse(raw) as T;
}

export async function runSalesActionCli(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;

  if (sub === 'policy-eval' && rest[0]) {
    const actionPath = rest[0];
    const contextPath = rest[1];
    const action = readJson<SalesAction>(actionPath);
    const context: SalesActionPolicyContext = contextPath ? readJson(contextPath) : {};
    const evaluation = evaluateSalesActionPolicy(action, context);
    const out = {
      schema_version: SALES_ACTION_SCHEMA_VERSION,
      action_id: action.action_id,
      evaluation,
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(evaluation.allowed ? 0 : 1);
  }

  if (sub === 'audit-append' && rest[0]) {
    const action = readJson<SalesAction>(rest[0]);
    const p = await appendSalesActionAudit(action);
    console.log(`appended audit record → ${p}`);
    return;
  }

  console.error('usage:');
  console.error('  nightshift sales sales-action policy-eval <action.json> [context.json]');
  console.error('    context.json may include deal_value_usd, enterprise_deal, recipient_email, message_body, account_opted_out');
  console.error('  nightshift sales sales-action audit-append <action.json>');
  console.error('');
  console.error('Exit code 1 if policy evaluation disallows execution (see JSON).');
  process.exit(2);
}

export function salesActionUsage(): string {
  return [
    'nightshift sales sales-action policy-eval <action.json> [context.json]',
    'nightshift sales sales-action audit-append <action.json>',
  ].join('\n');
}
