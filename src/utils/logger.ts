import { config } from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function threshold(): number {
  const lvl = (config.runtime.logLevel || 'info').toLowerCase() as Level;
  return LEVELS[lvl] ?? LEVELS.info;
}

function stamp(): string {
  return new Date().toISOString();
}

function write(level: Level, scope: string, msg: string, meta?: unknown): void {
  if (LEVELS[level] < threshold()) return;
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)} ${scope} ${msg}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(line, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export class Logger {
  constructor(private scope: string) {}
  child(sub: string): Logger {
    return new Logger(`${this.scope}:${sub}`);
  }
  debug(msg: string, meta?: unknown): void {
    write('debug', this.scope, msg, meta);
  }
  info(msg: string, meta?: unknown): void {
    write('info', this.scope, msg, meta);
  }
  warn(msg: string, meta?: unknown): void {
    write('warn', this.scope, msg, meta);
  }
  error(msg: string, meta?: unknown): void {
    write('error', this.scope, msg, meta);
  }
}

export const rootLogger = new Logger('nightshift');
