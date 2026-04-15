import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

export type PackageDecision = 'approved' | 'blocked' | 'queued';

interface PendingRequest {
  id: string;
  pkg: string;
  manager: 'npm' | 'pip' | 'cargo' | 'go';
  requestedAt: string;
  reason?: string;
}

const DANGEROUS_PATTERNS = [
  /^.+@.+-\d+$/i, // typosquat pattern
  /^[a-z0-9]{1}$/, // single-char package
  /install\.sh/i,
  /postinstall/i,
];

/**
 * Package install whitelist + approval queue.
 *
 * NightShift doesn't actually hook the subprocess's shell invocations — instead
 * the agent prompt is told to call a helper (or log intended installs) so we
 * can vet them. The whitelist/queue lives here so Discord can approve or reject
 * novel packages asynchronously.
 */
export class PackageApproval {
  private log = new Logger('packages');
  private pending = new Map<string, PendingRequest>();
  private runtimeAllow = new Set<string>();
  private runtimeBlock = new Set<string>();

  constructor(
    private baseWhitelist: string[] = config.safety.packageWhitelist,
    private projectDir: string = config.project.dir
  ) {}

  async load(): Promise<void> {
    const fromProject = await this.readProjectDeps();
    for (const pkg of fromProject) this.runtimeAllow.add(pkg.toLowerCase());
    for (const pkg of this.baseWhitelist) this.runtimeAllow.add(pkg.toLowerCase());
    this.log.info(`loaded ${this.runtimeAllow.size} allowed packages`);
  }

  private async readProjectDeps(): Promise<string[]> {
    const pkgs: string[] = [];
    try {
      const raw = await fs.readFile(path.join(this.projectDir, 'package.json'), 'utf8');
      const j = JSON.parse(raw);
      for (const name of [
        ...Object.keys(j.dependencies || {}),
        ...Object.keys(j.devDependencies || {}),
        ...Object.keys(j.peerDependencies || {}),
      ]) {
        pkgs.push(name);
      }
    } catch {
      /* no package.json */
    }
    try {
      const reqs = await fs.readFile(
        path.join(this.projectDir, 'requirements.txt'),
        'utf8'
      );
      for (const line of reqs.split('\n')) {
        const name = line.split(/[=<>!~]/)[0].trim();
        if (name && !name.startsWith('#')) pkgs.push(name);
      }
    } catch {
      /* no requirements.txt */
    }
    return pkgs;
  }

  decide(pkg: string, manager: PendingRequest['manager']): PackageDecision {
    const normalized = pkg.toLowerCase().trim();
    if (!normalized) return 'blocked';
    if (this.runtimeBlock.has(normalized)) return 'blocked';
    if (this.looksDangerous(normalized)) {
      this.runtimeBlock.add(normalized);
      return 'blocked';
    }
    if (this.runtimeAllow.has(normalized)) return 'approved';

    // Queue for human approval.
    const id = `${manager}:${normalized}:${Date.now()}`;
    this.pending.set(id, {
      id,
      pkg: normalized,
      manager,
      requestedAt: new Date().toISOString(),
    });
    this.log.info(`queued for approval: ${manager} ${normalized}`);
    return 'queued';
  }

  listPending(): PendingRequest[] {
    return [...this.pending.values()];
  }

  approve(pkg: string): boolean {
    const normalized = pkg.toLowerCase().trim();
    this.runtimeAllow.add(normalized);
    let removed = false;
    for (const [id, req] of this.pending) {
      if (req.pkg === normalized) {
        this.pending.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  reject(pkg: string): boolean {
    const normalized = pkg.toLowerCase().trim();
    this.runtimeBlock.add(normalized);
    let removed = false;
    for (const [id, req] of this.pending) {
      if (req.pkg === normalized) {
        this.pending.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  private looksDangerous(pkg: string): boolean {
    if (pkg.includes(' ')) return true;
    if (pkg.includes('..')) return true;
    return DANGEROUS_PATTERNS.some((p) => p.test(pkg));
  }

  /** Used to inject a helper instruction into agent prompts. */
  guidancePrompt(): string {
    const allowed = [...this.runtimeAllow].slice(0, 40).join(', ');
    return (
      `## Package installation policy\n` +
      `You MAY install packages already listed in the project's manifests ` +
      `or on the pre-approved list. Pre-approved: ${allowed}.\n` +
      `For ANY other package, do not install it. Instead output a line ` +
      `"PACKAGE_REQUEST: <manager> <name> <reason>" and continue without it.`
    );
  }
}

export const packageApproval = new PackageApproval();
