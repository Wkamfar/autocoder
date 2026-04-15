import { daemon } from './daemon.js';
import { ClawBot } from './discord/bot.js';
import { Logger } from './utils/logger.js';
import { handleCommand } from './discord/commands.js';
import { runDoctor, formatDoctorReport } from './safety/doctor.js';

const log = new Logger('main');

/**
 * Install a graceful shutdown handler that tears down the loop, restores the
 * target repo's main branch, and flushes state before exiting. Idempotent so
 * double-Ctrl-C doesn't cause a half-cleanup.
 */
function installShutdownHandlers(label: string): void {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      log.warn(`${signal} received again — forcing exit`);
      process.exit(130);
    }
    shuttingDown = true;
    log.info(`${signal} received, shutting down ${label}`);
    try {
      await daemon.shutdown();
    } catch (err) {
      log.error('shutdown failed', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', async (err) => {
    log.error('uncaught exception', err);
    try {
      await daemon.shutdown();
    } catch {}
    process.exit(1);
  });
  process.on('unhandledRejection', async (err) => {
    log.error('unhandled rejection', err);
    try {
      await daemon.shutdown();
    } catch {}
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'sales') {
    const { runSalesCli } = await import('./sales/cli.js');
    await runSalesCli(rest);
    process.exit(0);
  }

  // Doctor runs without touching the daemon (no state dir, no loop init).
  if (mode === 'doctor') {
    const report = await runDoctor();
    console.log(formatDoctorReport(report));
    process.exit(report.fatal ? 1 : 0);
  }

  await daemon.init();

  if (!mode || mode === 'daemon') {
    const { config } = await import('./config.js');
    const bot = config.discord.token ? new ClawBot(daemon) : null;
    if (bot) {
      await bot.login();
      log.info('nightshift daemon online (bot mode)');
    } else {
      log.info('nightshift daemon online (webhook-only mode — no bot token set)');
    }
    installShutdownHandlers('daemon');
    return;
  }

  if (mode === 'cli') {
    const cmd = rest[0];
    const args = rest.slice(1).join(' ');
    const reply = await handleCommand(daemon, cmd ?? 'help', args);
    console.log(reply);
    if (cmd === 'start' && daemon.getStatus()?.status === 'running') {
      installShutdownHandlers('cli-run');
      daemon.events.on('finished', async (s) => {
        log.info(`run finished with status=${s.status}`);
        await daemon.shutdown().catch(() => {});
        process.exit(0);
      });
      daemon.events.on('error', async (err) => {
        log.error('run errored', err);
        await daemon.shutdown().catch(() => {});
        process.exit(1);
      });
      return;
    }
    process.exit(0);
  }

  if (mode === 'run') {
    const objective = rest.join(' ');
    if (!objective) {
      console.error('usage: nightshift run <objective>');
      process.exit(2);
    }
    installShutdownHandlers('run');
    const state = await daemon.start(objective);
    log.info(`run ${state.run_id} started on ${state.branch}`);
    daemon.events.on('finished', async (s) => {
      log.info(`run finished with status=${s.status}`);
      await daemon.shutdown().catch(() => {});
      process.exit(0);
    });
    daemon.events.on('error', async (err) => {
      log.error('run errored', err);
      await daemon.shutdown().catch(() => {});
      process.exit(1);
    });
    return;
  }

  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}

main().catch((err) => {
  log.error('fatal', err);
  process.exit(1);
});
