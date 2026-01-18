import { prisma } from "../db/prisma.js";
import net from "node:net";

/**
 * Used by integration/E2E-ish tests to decide whether to run when Postgres is available.
 *
 * Important: in “fast” CI jobs or local lightweight runs, we want tests to skip quietly
 * when DATABASE_URL isn’t set (or DB is unreachable), rather than emitting scary Prisma
 * connection errors.
 */
export async function dbAvailable(): Promise<boolean> {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return false;
  if (process.env.SKIP_DB_TESTS === "1") return false;

  // Fast pre-check: avoid Prisma emitting noisy connection errors when the host/port is down.
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = Number(u.port || 5432);
    if (!host || !port) return false;

    const canConnect = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      const done = (ok: boolean) => {
        try { socket.destroy(); } catch {}
        resolve(ok);
      };
      socket.setTimeout(300);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });

    if (!canConnect) return false;
  } catch {
    // If URL parsing fails, fall through to Prisma check (it will fail and we will treat as unavailable).
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

