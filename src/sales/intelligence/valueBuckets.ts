/** Nominal USD buckets for segment differentiation (interpretable). */
export function dealValueBucketUsd(usd: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
  if (!Number.isFinite(usd) || usd <= 0) return 'xs';
  if (usd < 10_000) return 'xs';
  if (usd < 50_000) return 'sm';
  if (usd < 150_000) return 'md';
  if (usd < 500_000) return 'lg';
  return 'xl';
}

export function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 64);
}
