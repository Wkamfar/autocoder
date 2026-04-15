import { config } from '../config.js';
import { git, slugify, run } from '../utils/exec.js';
import { Logger } from '../utils/logger.js';

export class BranchManager {
  private log = new Logger('branch');
  private repoDir: string;
  private mainBranch: string;
  private prefix: string;

  constructor(
    repoDir: string = config.project.dir,
    mainBranch: string = config.project.mainBranch,
    prefix: string = config.project.branchPrefix
  ) {
    this.repoDir = repoDir;
    this.mainBranch = mainBranch;
    this.prefix = prefix;
  }

  get git() {
    return git(this.repoDir);
  }

  async createBranch(slugSource: string): Promise<string> {
    const slug = slugify(slugSource) || 'run';
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 12);
    const branch = `${this.prefix}/${slug}-${stamp}`;
    this.log.info(`creating branch ${branch} from ${this.mainBranch}`);
    await this.ensureClean();
    await this.git.checkoutNew(branch, this.mainBranch);
    return branch;
  }

  async ensureClean(): Promise<void> {
    const status = await this.git.status();
    if (status.trim()) {
      throw new Error(`working tree not clean in ${this.repoDir}:\n${status}`);
    }
  }

  async commitAll(message: string): Promise<string> {
    const status = await this.git.status();
    if (!status.trim()) return '';
    await this.git.add();
    return this.git.commit(message);
  }

  async revertTo(sha: string): Promise<void> {
    this.log.warn(`reverting to ${sha}`);
    await this.git.revert(sha);
  }

  async headSha(): Promise<string> {
    return this.git.headSha();
  }

  async mergeToMain(branch: string): Promise<void> {
    this.log.info(`merging ${branch} into ${this.mainBranch}`);
    await this.git.checkout(this.mainBranch);
    await this.git.merge(branch);
  }

  /**
   * Best-effort checkout back to the configured main branch. Used in crash /
   * shutdown paths so an interrupted run does not leave the working tree on a
   * nightshift/* branch. Any uncommitted changes are stashed with a marker ref
   * so the operator can recover them if needed.
   */
  async restoreMain(): Promise<void> {
    try {
      const current = await this.git.currentBranch();
      if (current === this.mainBranch) return;
      this.log.warn(`restoring working tree to ${this.mainBranch} from ${current}`);
      const dirty = (await this.git.status()).trim();
      if (dirty) {
        const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const stashRef = `nightshift/crash-wip-${stamp}`;
        await run('git', ['add', '-A'], { cwd: this.repoDir });
        await run(
          'git',
          ['commit', '--allow-empty', '-m', `nightshift: crash WIP ${stamp}`],
          { cwd: this.repoDir }
        );
        await run('git', ['branch', stashRef], { cwd: this.repoDir });
        this.log.warn(`uncommitted changes parked on ${stashRef}`);
      }
      await this.git.checkout(this.mainBranch);
    } catch (err) {
      this.log.error('failed to restore main branch', err);
    }
  }

  async runShell(cmd: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const r = await run('bash', ['-lc', cmd], { cwd: this.repoDir });
    return { code: r.code, stdout: r.stdout, stderr: r.stderr };
  }
}
