import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Partials,
  Message,
} from 'discord.js';
import { config } from '../config.js';
import { AgentRole } from '../types.js';
import { Logger } from '../utils/logger.js';
import { NightShiftDaemon } from '../daemon.js';
import { handleSalesCommand } from './salesCommands.js';

interface AgentBot {
  role: AgentRole;
  client: Client;
  channel: TextChannel | null;
  webhookUrl: string;
}

const ROLE_LABELS: Record<AgentRole, string> = {
  pm: 'PM',
  sales: 'Sales',
  research: 'Research',
  dev: 'Dev',
  legal: 'Legal',
};

const ROLE_PREFIXES: Record<AgentRole, string> = {
  pm: '!pm',
  sales: '!sales',
  research: '!research',
  dev: '!dev',
  legal: '!legal',
};

export class AgentBotManager {
  private bots = new Map<AgentRole, AgentBot>();
  private log = new Logger('agent-bots');

  constructor(private daemon: NightShiftDaemon) {}

  async loginAll(): Promise<void> {
    const agents = config.discord.agents;
    const roles: AgentRole[] = ['pm', 'sales', 'research', 'dev', 'legal'];

    for (const role of roles) {
      const cfg = agents[role];
      if (!cfg.token) {
        this.log.info(`${ROLE_LABELS[role]} agent: no token, skipping`);
        continue;
      }

      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel],
      });

      const bot: AgentBot = {
        role,
        client,
        channel: null,
        webhookUrl: cfg.webhookUrl,
      };

      client.once('ready', async () => {
        this.log.info(`${ROLE_LABELS[role]} agent logged in as ${client.user?.tag}`);
        if (cfg.channelId) {
          try {
            const ch = await client.channels.fetch(cfg.channelId);
            if (ch?.isTextBased()) bot.channel = ch as TextChannel;
          } catch (err) {
            this.log.warn(`${ROLE_LABELS[role]}: could not fetch channel`, err);
          }
        }
      });

      client.on('messageCreate', (m) => this.onAgentMessage(role, m));

      try {
        await client.login(cfg.token);
        this.bots.set(role, bot);
      } catch (err) {
        this.log.error(`${ROLE_LABELS[role]} agent login failed`, err);
      }
    }

    this.wireDaemonEvents();
    this.log.info(`${this.bots.size} agent bot(s) online`);
  }

  async shutdownAll(): Promise<void> {
    for (const [role, bot] of this.bots) {
      try {
        await bot.client.destroy();
        this.log.info(`${ROLE_LABELS[role]} agent shut down`);
      } catch {}
    }
    this.bots.clear();
  }

  async postTo(role: AgentRole, content: string): Promise<void> {
    const bot = this.bots.get(role);
    if (!bot?.channel) {
      this.log.info(`(no channel for ${role}) ${content.slice(0, 100)}`);
      return;
    }
    try {
      const msg = content.length > 1900 ? content.slice(0, 1900) + '...' : content;
      await bot.channel.send(msg);
    } catch (err) {
      this.log.warn(`post to ${role} failed`, err);
    }
  }

  async broadcast(content: string): Promise<void> {
    await Promise.allSettled(
      [...this.bots.keys()].map((role) => this.postTo(role, content))
    );
  }

  private async onAgentMessage(role: AgentRole, msg: Message): Promise<void> {
    if (msg.author.bot) return;

    const prefix = ROLE_PREFIXES[role];
    if (!msg.content.startsWith(prefix)) return;

    const ownerId = config.discord.ownerId;
    if (ownerId && msg.author.id !== ownerId) {
      await msg.reply('only the owner can issue agent commands.');
      return;
    }

    const parts = msg.content.slice(prefix.length).trim().split(/\s+/);
    const [cmd, ...rest] = parts;
    const args = rest.join(' ');

    try {
      let reply: string;
      switch (role) {
        case 'pm':
          reply = await this.handlePmCommand(cmd || 'help', args);
          break;
        case 'sales':
          reply = (await handleSalesCommand(msg, cmd || 'help', args)) || 'done.';
          break;
        case 'research':
          reply = await this.handleResearchCommand(cmd || 'help', args);
          break;
        case 'dev':
          reply = await this.handleDevCommand(cmd || 'help', args);
          break;
        case 'legal':
          reply = await this.handleLegalCommand(cmd || 'help', args);
          break;
        default:
          reply = `unknown agent role: ${role}`;
      }
      if (reply) {
        await msg.reply(reply.length > 1900 ? reply.slice(0, 1900) + '...' : reply);
      }
    } catch (err) {
      this.log.error(`${role} command failed`, err);
      await msg.reply(`error: ${(err as Error).message}`);
    }
  }

  private async handlePmCommand(cmd: string, args: string): Promise<string> {
    switch (cmd) {
      case 'help':
        return [
          '```',
          'PM Agent commands:',
          '  !pm status       — run status overview',
          '  !pm tasks        — task queue',
          '  !pm plan <obj>   — plan breakdown for an objective',
          '  !pm cost         — cost summary',
          '  !pm objectives   — queued objectives',
          '  !pm add <text>   — queue new objective',
          '```',
        ].join('\n');
      case 'status': {
        const s = this.daemon.getStatus();
        if (!s) return 'no active run.';
        const total = s.completed.length + s.task_queue.length + s.escalated.length;
        return [
          '```',
          `run: ${s.run_id}`,
          `objective: ${s.objective.title}`,
          `branch: ${s.branch}`,
          `progress: ${s.completed.length}/${total}`,
          `cost: $${s.total_cost_usd.toFixed(2)}`,
          `status: ${s.status}`,
          '```',
        ].join('\n');
      }
      case 'tasks': {
        const s = this.daemon.getStatus();
        if (!s) return 'no active run.';
        if (s.task_queue.length === 0) return 'queue empty.';
        return '```\n' + s.task_queue.map((t) => `${t.id} [${t.status}] ${t.title}`).join('\n') + '\n```';
      }
      case 'cost': {
        const s = this.daemon.getStatus();
        if (!s) return 'no active run.';
        return `cost: $${s.total_cost_usd.toFixed(2)} | ${s.total_tokens} tokens`;
      }
      case 'objectives': {
        const list = this.daemon.listObjectives();
        if (list.length === 0) return 'no objectives queued.';
        return '```\n' + list.map((o, i) => `${i + 1}. ${o.title}`).join('\n') + '\n```';
      }
      case 'add':
        if (!args) return 'need an objective.';
        this.daemon.addObjective({
          id: `obj-${Date.now()}`,
          title: args.slice(0, 80),
          description: args,
          priority: 1,
        });
        return 'objective queued.';
      default:
        return `unknown PM command: ${cmd}. try !pm help`;
    }
  }

  private async handleResearchCommand(cmd: string, args: string): Promise<string> {
    switch (cmd) {
      case 'help':
        return [
          '```',
          'Research Agent commands:',
          '  !research status    — brain knowledge status',
          '  !research patterns  — known patterns',
          '  !research errors    — known error patterns',
          '  !research help      — this message',
          '```',
        ].join('\n');
      case 'status':
        return 'brain knowledge index active. use `!ns rediscover` via main bot to refresh.';
      default:
        return `unknown research command: ${cmd}. try !research help`;
    }
  }

  private async handleDevCommand(cmd: string, args: string): Promise<string> {
    switch (cmd) {
      case 'help':
        return [
          '```',
          'Dev Agent commands:',
          '  !dev status     — current task status',
          '  !dev fallback   — model fallback state',
          '  !dev doctor     — pre-flight check',
          '  !dev help       — this message',
          '```',
        ].join('\n');
      case 'status': {
        const s = this.daemon.getStatus();
        if (!s) return 'no active run.';
        return `current task: ${s.current_task_id ?? 'none'} | branch: ${s.branch}`;
      }
      case 'fallback': {
        const snap = this.daemon.fallbackSnapshot();
        if (snap.length === 0) return 'all model tiers healthy.';
        return '```\n' + snap.map((s) =>
          `${s.tier} fails=${s.count} cooldown=${Math.round(s.cooldownMs / 1000)}s`
        ).join('\n') + '\n```';
      }
      case 'doctor': {
        const { formatDoctorReport } = await import('../safety/doctor.js');
        const report = await this.daemon.doctor();
        return '```\n' + formatDoctorReport(report) + '\n```';
      }
      default:
        return `unknown dev command: ${cmd}. try !dev help`;
    }
  }

  private async handleLegalCommand(cmd: string, _args: string): Promise<string> {
    switch (cmd) {
      case 'help':
        return [
          '```',
          'Legal Agent commands:',
          '  !legal status     — compliance check status',
          '  !legal packages   — pending package approvals',
          '  !legal help       — this message',
          '```',
        ].join('\n');
      case 'status':
        return 'legal compliance agent online. monitoring package requests and scope violations.';
      case 'packages': {
        const pending = this.daemon.listPendingPackages();
        if (pending.length === 0) return 'no packages pending approval.';
        return '```\n' + pending.map((p) =>
          `${p.manager} ${p.pkg} (queued ${p.requestedAt})`
        ).join('\n') + '\n```';
      }
      default:
        return `unknown legal command: ${cmd}. try !legal help`;
    }
  }

  private wireDaemonEvents(): void {
    this.daemon.events.on('taskStart', (task) => {
      this.postTo('pm', `[PM] task started: ${task.id} — ${task.title}`);
      this.postTo('dev', `[DEV] working on: ${task.id} — ${task.title}`);
    });

    this.daemon.events.on('taskComplete', (task, result) => {
      const icon = result.status === 'passed' ? 'OK' : result.status === 'escalated' ? 'ESC' : 'FAIL';
      this.postTo('pm', `[PM] [${icon}] ${task.id} — $${result.cost_usd.toFixed(3)}`);
      this.postTo('dev', `[DEV] [${icon}] ${task.id} via ${result.engine} (${result.mode})`);
      if (result.learnings.length > 0) {
        this.postTo('research', `[RESEARCH] learnings from ${task.id}:\n${result.learnings.join('\n')}`);
      }
    });

    this.daemon.events.on('escalation', (task, reason) => {
      const ownerId = config.discord.ownerId;
      const ping = ownerId ? `\n<@${ownerId}>` : '';
      this.postTo('pm', `[PM] ESCALATION — ${task.id}: ${reason.slice(0, 500)}${ping}`);
      this.postTo('dev', `[DEV] ESCALATION — ${task.id} needs human review${ping}`);
    });

    this.daemon.events.on('finished', (state) => {
      const msg = `run ${state.run_id} finished (${state.status}) — $${state.total_cost_usd.toFixed(2)}`;
      this.postTo('pm', `[PM] ${msg}`);
      this.postTo('dev', `[DEV] ${msg}`);
    });

    this.daemon.events.on('error', (err) => {
      const ownerId = config.discord.ownerId;
      const ping = ownerId ? `\n<@${ownerId}>` : '';
      this.postTo('pm', `[PM] loop error: ${(err as Error).message}${ping}`);
      this.postTo('dev', `[DEV] loop error: ${(err as Error).message}${ping}`);
    });
  }
}
