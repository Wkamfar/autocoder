export class CircuitOpenError extends Error {
  public readonly retryAt: Date;
  public readonly key: string;
  constructor(key: string, retryAt: Date) {
    super(`Circuit open for ${key} until ${retryAt.toISOString()}`);
    this.name = "CircuitOpenError";
    this.key = key;
    this.retryAt = retryAt;
  }
}

type CircuitState = {
  failures: number;
  openUntil: number; // epoch ms, 0 = closed
  lastFailureAt: number;
};

const circuits = new Map<string, CircuitState>();

function getState(key: string): CircuitState {
  let st = circuits.get(key);
  if (!st) {
    st = { failures: 0, openUntil: 0, lastFailureAt: 0 };
    circuits.set(key, st);
  }
  return st;
}

export type CircuitBreakerConfig = {
  failureThreshold: number; // failures before opening
  openMs: number; // how long to stay open
};

export function defaultCircuitConfig(): CircuitBreakerConfig {
  return {
    failureThreshold: Number(process.env.CB_FAILURE_THRESHOLD || 5),
    openMs: Number(process.env.CB_OPEN_MS || 30_000),
  };
}

export function assertCircuitAllows(key: string, cfg: CircuitBreakerConfig = defaultCircuitConfig()): void {
  const st = getState(key);
  const now = Date.now();
  if (st.openUntil > now) {
    throw new CircuitOpenError(key, new Date(st.openUntil));
  }
  // If we were open and the window passed, allow again (half-open simplified).
}

export function recordCircuitSuccess(key: string): void {
  const st = getState(key);
  st.failures = 0;
  st.openUntil = 0;
}

export function recordCircuitFailure(key: string, cfg: CircuitBreakerConfig = defaultCircuitConfig()): void {
  const st = getState(key);
  st.failures++;
  st.lastFailureAt = Date.now();
  if (st.failures >= cfg.failureThreshold) {
    st.openUntil = Date.now() + cfg.openMs;
  }
}

