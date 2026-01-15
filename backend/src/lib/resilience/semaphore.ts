type Waiter = () => void;

type SemaphoreState = {
  current: number;
  queue: Waiter[];
};

const semaphores = new Map<string, SemaphoreState>();

function getState(key: string): SemaphoreState {
  let st = semaphores.get(key);
  if (!st) {
    st = { current: 0, queue: [] };
    semaphores.set(key, st);
  }
  return st;
}

export async function withSemaphore<T>(
  key: string,
  limit: number,
  fn: () => Promise<T>
): Promise<T> {
  if (limit <= 0) return await fn();

  const st = getState(key);
  if (st.current >= limit) {
    await new Promise<void>((resolve) => st.queue.push(resolve));
  }
  st.current++;

  try {
    return await fn();
  } finally {
    st.current = Math.max(0, st.current - 1);
    const next = st.queue.shift();
    if (next) next();
  }
}

