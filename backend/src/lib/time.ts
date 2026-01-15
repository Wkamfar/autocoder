export function nowIso(): string {
  return new Date().toISOString();
}

export function toDate(iso: string): Date {
  return new Date(iso);
}

