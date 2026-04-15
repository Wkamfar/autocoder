#!/usr/bin/env node
/**
 * Emit a 100-row CSV for Builder milestone testing (plan §9).
 * Usage: node scripts/gen-milestone-csv.mjs > /tmp/milestone100.csv
 */
const n = 100;
const lines = ['company,email,domain,name,segment,vertical'];
for (let i = 1; i <= n; i++) {
  const company = `Milestone Test Co ${i}`;
  const domain = `milestone${i}.example.com`;
  const email = `buyer${i}@${domain}`;
  const name = `Buyer ${i}`;
  const segment = i % 5 === 0 ? 'parametric_risk' : 'midsize_finance';
  const vertical = 'parametric_risk_markets';
  lines.push([company, email, domain, name, segment, vertical].join(','));
}
console.log(lines.join('\n'));
