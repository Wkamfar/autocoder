/**
 * Deterministic dossier/world resolution — CRM vs JSON (Phase 2).
 * @see docs/CRM_SALES_OS_UNIFICATION.md §6
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { initSalesMode } from '../salesContext.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import type { DossierScope } from './types.js';
import type { SalesWorldFile } from './types.js';
import { defaultWorldPath, loadSalesWorld } from './fileWorldStore.js';
import { salesWorldFromCrmRepository } from './crmWorldDataSource.js';

export type DossierProvenance = 'world_only' | 'crm_backed' | 'crm_snapshot';

/** CLI `--source` / `SALES_DOSSIER_SOURCE`. */
export type DossierSourceKind = 'crm' | 'world' | 'auto';

export type ResolvedSalesWorld = {
  world: SalesWorldFile;
  provenance: DossierProvenance;
  /** Effective source after `auto` resolution. */
  source_used: DossierSourceKind;
};

export function defaultDossierSourceFromEnv(): DossierSourceKind {
  const v = process.env.SALES_DOSSIER_SOURCE?.toLowerCase();
  if (v === 'crm' || v === 'world' || v === 'auto') return v;
  return 'auto';
}

/** Strip `--source <crm|world|auto>` from argv; CLI overrides env. */
export function takeDossierSourceFromArgv(argv: string[]): {
  source: DossierSourceKind;
  argv: string[];
} {
  let source = defaultDossierSourceFromEnv();
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') {
      const v = argv[++i]?.toLowerCase();
      if (v === 'crm' || v === 'world' || v === 'auto') source = v;
      continue;
    }
    out.push(a);
  }
  return { source, argv: out };
}

export function crmDatabaseFileExists(): boolean {
  try {
    return fs.existsSync(path.resolve(config.sales.dbPath));
  } catch {
    return false;
  }
}

export function provenanceFromLoadedWorldFile(world: SalesWorldFile): DossierProvenance {
  const w = world as unknown as Record<string, unknown>;
  if (w.source === 'crm_snapshot') return 'crm_snapshot';
  return 'world_only';
}

export function entityExistsInCrm(repo: SalesRepository, scope: DossierScope): boolean {
  switch (scope.kind) {
    case 'deal':
      return !!repo.getDeal(scope.id);
    case 'account':
      return !!repo.getAccount(scope.id);
    case 'contact':
      return !!repo.getContact(scope.id);
    default: {
      const _x: never = scope;
      return _x;
    }
  }
}

/**
 * Ranking / global world (top-decisions): §6 step 3 requires a deal_id for CRM in `auto`;
 * without it we use JSON (step 4). `--source crm` always uses live CRM when the DB file exists.
 */
export function resolveRankingWorld(input: {
  source: DossierSourceKind;
  worldPath?: string;
}): ResolvedSalesWorld {
  const wp = input.worldPath ?? defaultWorldPath();

  if (input.source === 'crm') {
    if (!crmDatabaseFileExists()) {
      throw new Error(
        `dossier --source crm requires SALES_DB_PATH to exist (got ${path.resolve(config.sales.dbPath)})`
      );
    }
    const { repo } = initSalesMode();
    const world = salesWorldFromCrmRepository(repo);
    return { world, provenance: 'crm_backed', source_used: 'crm' };
  }

  if (input.source === 'world') {
    const world = loadSalesWorld(wp);
    return { world, provenance: provenanceFromLoadedWorldFile(world), source_used: 'world' };
  }

  const world = loadSalesWorld(wp);
  return { world, provenance: provenanceFromLoadedWorldFile(world), source_used: 'auto' };
}

/**
 * Scoped dossier (pair-debate, single-decision, …): `auto` uses CRM when the entity id exists in SQLite.
 */
export function resolveScopedWorld(input: {
  source: DossierSourceKind;
  worldPath?: string;
  scope: DossierScope;
}): ResolvedSalesWorld {
  const wp = input.worldPath ?? defaultWorldPath();

  if (input.source === 'crm') {
    if (!crmDatabaseFileExists()) {
      throw new Error(
        `dossier --source crm requires SALES_DB_PATH to exist (got ${path.resolve(config.sales.dbPath)})`
      );
    }
    const { repo } = initSalesMode();
    if (!entityExistsInCrm(repo, input.scope)) {
      throw new Error(
        `dossier --source crm: ${input.scope.kind} "${input.scope.id}" not found in CRM`
      );
    }
    const world = salesWorldFromCrmRepository(repo);
    return { world, provenance: 'crm_backed', source_used: 'crm' };
  }

  if (input.source === 'world') {
    const world = loadSalesWorld(wp);
    return { world, provenance: provenanceFromLoadedWorldFile(world), source_used: 'world' };
  }

  if (crmDatabaseFileExists()) {
    const { repo } = initSalesMode();
    if (entityExistsInCrm(repo, input.scope)) {
      const world = salesWorldFromCrmRepository(repo);
      return { world, provenance: 'crm_backed', source_used: 'auto' };
    }
  }

  const world = loadSalesWorld(wp);
  return { world, provenance: provenanceFromLoadedWorldFile(world), source_used: 'auto' };
}
