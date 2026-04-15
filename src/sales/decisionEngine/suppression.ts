import type { SalesWorldFile } from '../world/types.js';

/** `suppression_flags` entries: `deal:<id>`, `account:<id>`, or `debate:all`. */
export function isDealSuppressed(world: SalesWorldFile, dealId: string, accountId: string): boolean {
  const flags = world.suppression_flags ?? [];
  if (flags.includes('debate:all')) return true;
  if (flags.includes(`deal:${dealId}`)) return true;
  if (flags.includes(`account:${accountId}`)) return true;
  return false;
}
