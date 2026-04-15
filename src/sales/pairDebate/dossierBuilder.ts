import type { DossierPack } from './types.js';
import type { DossierScope } from '../world/types.js';
import type { SalesWorldFile } from '../world/types.js';
import {
  resolveContextForAccount,
  resolveContextForContact,
  resolveContextForDeal,
} from '../world/customerContextBuilder.js';
import { appendPatternsToDossierBody, buildHistoricalPatternsForDossier } from './patternRecall.js';

/** Build DossierPack (truth layer) for Pair Debate from file-backed world. */
export function buildDossierPack(world: SalesWorldFile, scope: DossierScope): DossierPack {
  let pack: DossierPack;
  switch (scope.kind) {
    case 'deal':
      pack = resolveContextForDeal(world, scope.id);
      break;
    case 'account':
      pack = resolveContextForAccount(world, scope.id);
      break;
    case 'contact':
      pack = resolveContextForContact(world, scope.id);
      break;
    default: {
      const _x: never = scope;
      return _x;
    }
  }
  if (!/^(1|true|yes|on)$/i.test(process.env.PAIR_DEBATE_NO_PATTERNS ?? '')) {
    appendPatternsToDossierBody(pack, buildHistoricalPatternsForDossier());
  }
  return pack;
}

/** Seed facts_locked lines from dossier (non-exhaustive, stable cues). */
export function seedFactsFromDossier(d: DossierPack): string[] {
  const lines = d.body.split('\n').filter((l) => l.trim().startsWith('- '));
  return lines.slice(0, 8).map((l) => l.replace(/^\s*-\s*/, '').trim());
}
