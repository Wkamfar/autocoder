import { NightShiftDaemon } from '../daemon.js';
import { RunState, Task } from '../types.js';
import { formatDoctorReport } from '../safety/doctor.js';

export const COMMAND_HELP = `NightShift commands:
  !ns start <objective>        start a new run
  !ns status                   current progress + cost
  !ns tasks                    list remaining tasks
  !ns pause                    pause after current task
  !ns resume                   resume the loop
  !ns stop                     stop and commit WIP
  !ns inject <text>            inject instructions into live run
  !ns reprioritize <task_id>   move task to front of queue
  !ns skip <task_id>           skip a task
  !ns diff                     branch-vs-main comparison
  !ns cost                     token + cost breakdown
  !ns report                   generate report now
  !ns accept                   merge branch into main
  !ns objectives               list queued objectives
  !ns add-objective <text>     queue an objective
  !ns rediscover               rerun codebase discovery
  !ns rollback <task_id>       reset to the task's pre-checkpoint
  !ns packages                 list pending package install requests
  !ns approve <pkg>            approve a queued package
  !ns reject <pkg>             reject a queued package
  !ns fallback                 show model fallback / cooldown state
  !ns doctor                   pre-flight check (env, binaries, repos)
  !ns link-brain               wire the OpenClaw brain git remote and verify fetch
  !ns help                     show this`;

export async function handleCommand(
  daemon: NightShiftDaemon,
  cmd: string,
  args: string
): Promise<string> {
  switch (cmd) {
    case 'help':
      return '```\n' + COMMAND_HELP + '\n```';

    case 'start': {
      if (!args) return 'need an objective. example: `!ns start Build the API layer`';
      const state = await daemon.start(args);
      return `started run \`${state.run_id}\` on \`${state.branch}\` with ${state.task_queue.length} tasks.`;
    }

    case 'status': {
      const s = daemon.getStatus();
      return s ? formatStatus(s) : 'no active run.';
    }

    case 'tasks': {
      const s = daemon.getStatus();
      if (!s) return 'no active run.';
      if (s.task_queue.length === 0) return 'queue is empty.';
      return '```\n' + s.task_queue.map(taskLine).join('\n') + '\n```';
    }

    case 'pause':
      await daemon.pause();
      return 'paused. loop will stop after the current task.';

    case 'resume':
      await daemon.resume();
      return 'resumed.';

    case 'stop':
      await daemon.stop();
      return 'stopping. WIP will be committed on the test branch.';

    case 'inject':
      if (!args) return 'need an instruction.';
      await daemon.injectInstruction(args);
      return 'instruction injected. will apply to the next task.';

    case 'reprioritize':
      if (!args) return 'need a task id.';
      await daemon.reprioritize(args);
      return `moved ${args} to the front of the queue.`;

    case 'skip':
      if (!args) return 'need a task id.';
      await daemon.skip(args);
      return `skipped ${args}.`;

    case 'diff':
    case 'report': {
      const report = await daemon.comparisonReport();
      if (!report) return 'no run to report.';
      return (
        '```\n' +
        [
          `branch: ${report.branch}`,
          `files: ${report.stats.files_changed}, +${report.stats.insertions}/-${report.stats.deletions}`,
          `tests main: ${report.tests.main.passed}/${report.tests.main.failed}`,
          `tests branch: ${report.tests.branch.passed}/${report.tests.branch.failed}`,
          `regressions: ${report.tests.regressions.join(', ') || 'none'}`,
          `lint: ${report.lint.main_errors} → ${report.lint.branch_errors}`,
          `commits: ${report.commits.length}`,
          `escalated: ${report.escalated_tasks.length}`,
        ].join('\n') +
        '\n```'
      );
    }

    case 'cost': {
      const s = daemon.getStatus();
      if (!s) return 'no active run.';
      return `cost so far: $${s.total_cost_usd.toFixed(2)} across ${s.total_tokens} tokens`;
    }

    case 'accept':
      await daemon.mergeToMain();
      return 'merged branch into main.';

    case 'objectives': {
      const list = daemon.listObjectives();
      if (list.length === 0) return 'no objectives queued.';
      return '```\n' + list.map((o, i) => `${i + 1}. ${o.title}`).join('\n') + '\n```';
    }

    case 'add-objective': {
      if (!args) return 'need an objective.';
      daemon.addObjective({
        id: `obj-${Date.now()}`,
        title: args.slice(0, 80),
        description: args,
        priority: 1,
      });
      return 'queued.';
    }

    case 'rediscover': {
      await daemon.rediscover();
      return 'discovery complete. architecture.md refreshed.';
    }

    case 'rollback': {
      if (!args) return 'need a task id.';
      const ok = await daemon.rollbackTask(args);
      return ok ? `rolled back to pre-${args} checkpoint.` : `no checkpoint found for ${args}.`;
    }

    case 'packages': {
      const pending = daemon.listPendingPackages();
      if (pending.length === 0) return 'no packages pending approval.';
      return (
        '```\n' +
        pending
          .map((p) => `${p.manager}  ${p.pkg}  (queued ${p.requestedAt})`)
          .join('\n') +
        '\n```'
      );
    }

    case 'approve': {
      if (!args) return 'need a package name.';
      return daemon.approvePackage(args) ? `approved ${args}.` : `no pending entry for ${args}.`;
    }

    case 'reject': {
      if (!args) return 'need a package name.';
      return daemon.rejectPackage(args) ? `rejected ${args}.` : `no pending entry for ${args}.`;
    }

    case 'doctor': {
      const report = await daemon.doctor();
      return '```\n' + formatDoctorReport(report) + '\n```';
    }

    case 'link-brain':
    case 'linkbrain': {
      const msg = await daemon.linkBrain();
      return '```\n' + msg + '\n```';
    }

    case 'fallback': {
      const snap = daemon.fallbackSnapshot();
      if (snap.length === 0) return 'all model tiers healthy.';
      return (
        '```\n' +
        snap
          .map(
            (s) =>
              `${s.tier}  fails=${s.count}  cooldown=${Math.round(s.cooldownMs / 1000)}s  last=${s.error.slice(0, 60)}`
          )
          .join('\n') +
        '\n```'
      );
    }

    default:
      return `unknown command \`${cmd}\`. try \`!ns help\`.`;
  }
}

function taskLine(t: Task): string {
  return `${t.id} [${t.status}] ${t.complexity}/${t.risk} ${t.title}`;
}

function formatStatus(s: RunState): string {
  const total = s.completed.length + s.task_queue.length + s.escalated.length;
  return (
    '```\n' +
    [
      `run ${s.run_id}`,
      `branch ${s.branch}`,
      `objective: ${s.objective.title}`,
      `progress: ${s.completed.length}/${total}`,
      `current: ${s.current_task_id ?? '—'}`,
      `cost: $${s.total_cost_usd.toFixed(2)}`,
      `escalated: ${s.escalated.length}`,
      `status: ${s.status}`,
    ].join('\n') +
    '\n```'
  );
}
