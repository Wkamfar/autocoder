#!/usr/bin/env node
/**
 * Structural validation for SalesWorldFile-like JSON (CI + local).
 * Does not call engines or Discord.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/** @param {unknown} obj */
export function validateSalesWorldShape(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { ok: false, errors: ['root must be a JSON object'] };
  }
  const o = /** @type {Record<string, unknown>} */ (obj);
  for (const k of ['accounts', 'contacts', 'deals', 'activities']) {
    if (!Array.isArray(o[k])) errors.push(`"${k}" must be an array`);
  }
  if (Array.isArray(o.accounts)) {
    o.accounts.forEach((a, i) => {
      if (!a || typeof a !== 'object') errors.push(`accounts[${i}] invalid`);
      else {
        const x = /** @type {Record<string, unknown>} */ (a);
        if (typeof x.id !== 'string' || !x.id.length) errors.push(`accounts[${i}].id required`);
      }
    });
  }
  if (Array.isArray(o.deals)) {
    o.deals.forEach((d, i) => {
      if (!d || typeof d !== 'object') errors.push(`deals[${i}] invalid`);
      else {
        const x = /** @type {Record<string, unknown>} */ (d);
        if (typeof x.id !== 'string' || !x.id.length) errors.push(`deals[${i}].id required`);
        if (typeof x.account_id !== 'string' || !x.account_id.length) errors.push(`deals[${i}].account_id required`);
        if (typeof x.stage !== 'string' || !x.stage.length) errors.push(`deals[${i}].stage required`);
      }
    });
  }
  if (Array.isArray(o.contacts)) {
    o.contacts.forEach((c, i) => {
      if (!c || typeof c !== 'object') errors.push(`contacts[${i}] invalid`);
      else {
        const x = /** @type {Record<string, unknown>} */ (c);
        if (typeof x.id !== 'string' || !x.id.length) errors.push(`contacts[${i}].id required`);
        if (typeof x.account_id !== 'string') errors.push(`contacts[${i}].account_id required`);
      }
    });
  }
  if (Array.isArray(o.activities)) {
    o.activities.forEach((a, i) => {
      if (!a || typeof a !== 'object') errors.push(`activities[${i}] invalid`);
      else {
        const x = /** @type {Record<string, unknown>} */ (a);
        if (typeof x.id !== 'string') errors.push(`activities[${i}].id required`);
        if (typeof x.at !== 'string') errors.push(`activities[${i}].at required`);
        if (typeof x.type !== 'string') errors.push(`activities[${i}].type required`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const p = process.argv[2];
  if (!p) {
    console.error('usage: node scripts/validate-sales-world-shape.mjs <path-to-world.json>');
    process.exit(2);
  }
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw);
  const r = validateSalesWorldShape(data);
  if (!r.ok) {
    console.error('Sales world shape invalid:');
    for (const e of r.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('sales world shape ok:', p);
}

const entry = process.argv[1] && path.resolve(process.argv[1]);
if (entry === path.resolve(__filename)) {
  main();
}
