import type { FinalDebateSynthesis } from '../../sales/pairDebate/types.js';

/** Indexed rows from a /top-decisions message (button handlers resolve deal id). */
export interface TopDecisionsMessagePayload {
  dealIds: string[];
  createdAt: number;
}

export interface StoredDealRun {
  dealId: string;
  runId: string;
  scopeLabel: string;
  accountName?: string;
  valueUsd: number;
  synthesis: FinalDebateSynthesis;
  logPath: string;
  exportDir?: string;
  totalCostUsd: number;
  totalTokens: number;
  guildId: string;
  channelId: string;
}

const topByMessage = new Map<string, TopDecisionsMessagePayload>();
/** Latest successful Pair Debate per guild channel + deal */
const lastRun = new Map<string, StoredDealRun>();
/** threadId -> run key for button routing */
const threadToRunKey = new Map<string, string>();
/** Reuse thread per guild+channel+deal */
const dealToThread = new Map<string, string>();

export function keyGuildChannelDeal(guildId: string, channelId: string, dealId: string): string {
  return `${guildId}:${channelId}:${dealId}`;
}

export function setTopDecisionsPayload(messageId: string, dealIds: string[]): void {
  topByMessage.set(messageId, { dealIds, createdAt: Date.now() });
}

export function getTopDecisionsPayload(messageId: string): TopDecisionsMessagePayload | undefined {
  return topByMessage.get(messageId);
}

export function setLastRun(k: string, run: StoredDealRun): void {
  lastRun.set(k, run);
}

export function getLastRun(k: string): StoredDealRun | undefined {
  return lastRun.get(k);
}

export function bindThreadToRunKey(threadId: string, runKey: string): void {
  threadToRunKey.set(threadId, runKey);
}

export function rememberDealThread(runKey: string, threadId: string): void {
  dealToThread.set(runKey, threadId);
}

export function getDealThread(runKey: string): string | undefined {
  return dealToThread.get(runKey);
}

export function getRunKeyForThread(threadId: string): string | undefined {
  return threadToRunKey.get(threadId);
}

/** Prune old top-decision maps (avoid unbounded memory). */
const TTL_MS = 86_400_000;
export function pruneTopPayloads(): void {
  const now = Date.now();
  for (const [id, p] of topByMessage) {
    if (now - p.createdAt > TTL_MS) topByMessage.delete(id);
  }
}
