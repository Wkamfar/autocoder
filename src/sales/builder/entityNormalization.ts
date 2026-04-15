/** Normalize registrable domain for resolution (plan §3.1). */

const SUFFIX_RE = /\b(inc|llc|l\.l\.c\.|ltd|corp|corporation|co\.|company)\b\.?$/i;

export function normalizeRegistrableDomain(domain: string | undefined): string | undefined {
  if (!domain?.trim()) return undefined;
  let d = domain.trim().toLowerCase();
  if (d.startsWith('http://')) d = d.slice(7);
  if (d.startsWith('https://')) d = d.slice(8);
  const slash = d.indexOf('/');
  if (slash >= 0) d = d.slice(0, slash);
  if (d.startsWith('www.')) d = d.slice(4);
  return d || undefined;
}

/** Normalize legal / display company name for fuzzy equality. */
export function normalizeLegalName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n.replace(/[.,'"()]/g, ' ');
  n = n.replace(SUFFIX_RE, '');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

export function emailDomain(email: string | undefined): string | undefined {
  if (!email?.includes('@')) return undefined;
  const part = email.split('@')[1]?.trim().toLowerCase();
  return part || undefined;
}
