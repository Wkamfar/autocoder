import { config } from '../config.js';
import { openSalesDatabase, getSalesDatabase, type SalesDatabase } from './storage/salesDb.js';
import { SalesRepository } from './storage/salesRepository.js';
import { MutationApplyService } from './builder/mutationApplyService.js';

export interface SalesContext {
  db: SalesDatabase;
  repo: SalesRepository;
  applyService: MutationApplyService;
}

let ctx: SalesContext | null = null;

export function initSalesMode(): SalesContext {
  if (ctx) return ctx;
  const db = openSalesDatabase(config.sales.dbPath);
  const repo = new SalesRepository(db);
  const applyService = new MutationApplyService(repo);
  ctx = { db, repo, applyService };
  return ctx;
}

export function getSalesContext(): SalesContext {
  if (!ctx) return initSalesMode();
  getSalesDatabase();
  return ctx;
}
