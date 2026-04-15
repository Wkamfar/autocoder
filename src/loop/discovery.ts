import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { BrainPersistence, brain } from '../brain/persistence.js';
import { run } from '../utils/exec.js';
import { Logger } from '../utils/logger.js';

interface DiscoveryResult {
  language: string;
  framework: string | null;
  testRunner: string | null;
  buildCommand: string | null;
  devCommand: string | null;
  entryPoints: string[];
  routes: string[];
  models: string[];
  externalCalls: string[];
  totalFiles: number;
  directoryTree: string;
}

/**
 * On first run (or when forced via `!ns rediscover`), scan the project and
 * write a structured `knowledge/architecture.md` so the planner has real
 * context instead of running blind.
 */
export class DiscoveryBootstrap {
  private log = new Logger('discovery');

  constructor(
    private projectDir: string = config.project.dir,
    private brainStore: BrainPersistence = brain
  ) {}

  async needsDiscovery(): Promise<boolean> {
    const arch = await this.brainStore.readKnowledge('architecture.md');
    return arch.trim().length < 100;
  }

  async run(force = false): Promise<DiscoveryResult | null> {
    if (!force && !(await this.needsDiscovery())) {
      this.log.debug('architecture.md already populated, skipping discovery');
      return null;
    }
    this.log.info(`scanning ${this.projectDir}`);

    const [language, framework] = await this.detectStack();
    const testRunner = await this.detectTestRunner();
    const buildCommand = await this.detectScript('build');
    const devCommand = await this.detectScript('dev');
    const entryPoints = await this.findEntryPoints();
    const routes = await this.findRoutes();
    const models = await this.findModels();
    const externalCalls = await this.findExternalCalls();
    const totalFiles = await this.countFiles();
    const directoryTree = await this.mapDirectory();

    const result: DiscoveryResult = {
      language,
      framework,
      testRunner,
      buildCommand,
      devCommand,
      entryPoints,
      routes,
      models,
      externalCalls,
      totalFiles,
      directoryTree,
    };

    await this.writeBrain(result);
    return result;
  }

  private async detectStack(): Promise<[string, string | null]> {
    if (await this.has('package.json')) {
      try {
        const pkg = JSON.parse(
          await fs.readFile(path.join(this.projectDir, 'package.json'), 'utf8')
        );
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.next) return ['typescript', 'Next.js'];
        if (deps['@remix-run/react']) return ['typescript', 'Remix'];
        if (deps.express) return ['typescript', 'Express'];
        if (deps.fastify) return ['typescript', 'Fastify'];
        if (deps.nestjs || deps['@nestjs/core']) return ['typescript', 'NestJS'];
        return ['typescript', null];
      } catch {
        return ['javascript', null];
      }
    }
    if (await this.has('pyproject.toml')) return ['python', null];
    if (await this.has('requirements.txt')) return ['python', null];
    if (await this.has('go.mod')) return ['go', null];
    if (await this.has('Cargo.toml')) return ['rust', null];
    return ['unknown', null];
  }

  private async detectTestRunner(): Promise<string | null> {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(this.projectDir, 'package.json'), 'utf8')
      );
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
    } catch {
      /* ignore */
    }
    if (await this.has('pytest.ini')) return 'pytest';
    if (await this.has('pyproject.toml')) return 'pytest';
    if (await this.has('go.mod')) return 'go test';
    if (await this.has('Cargo.toml')) return 'cargo test';
    return null;
  }

  private async detectScript(name: string): Promise<string | null> {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(this.projectDir, 'package.json'), 'utf8')
      );
      if (pkg?.scripts?.[name]) return `npm run ${name}`;
    } catch {
      /* ignore */
    }
    return null;
  }

  private async findEntryPoints(): Promise<string[]> {
    const candidates = [
      'src/index.ts',
      'src/main.ts',
      'src/server.ts',
      'src/app.ts',
      'index.js',
      'main.py',
      'app.py',
      'cmd/main.go',
    ];
    const found: string[] = [];
    for (const c of candidates) {
      if (await this.has(c)) found.push(c);
    }
    return found;
  }

  private async findRoutes(): Promise<string[]> {
    const r = await run(
      'bash',
      [
        '-lc',
        `grep -RInE "(app\\.(get|post|put|delete|patch)\\(|router\\.(get|post|put|delete|patch)\\(|@app\\.route|fastify\\.(get|post)|@Get|@Post)" --include='*.{ts,js,py}' . 2>/dev/null | head -40`,
      ],
      { cwd: this.projectDir }
    );
    return r.stdout.split('\n').filter(Boolean).slice(0, 40);
  }

  private async findModels(): Promise<string[]> {
    const r = await run(
      'bash',
      [
        '-lc',
        `grep -RInE "(class [A-Z][A-Za-z0-9]+\\(Base\\)|model\\.Schema|prisma\\.[a-zA-Z]+\\.(create|findMany)|@Entity)" --include='*.{ts,js,py}' . 2>/dev/null | head -30`,
      ],
      { cwd: this.projectDir }
    );
    return r.stdout.split('\n').filter(Boolean).slice(0, 30);
  }

  private async findExternalCalls(): Promise<string[]> {
    const r = await run(
      'bash',
      [
        '-lc',
        `grep -RInE "(fetch\\(|axios\\.|requests\\.(get|post))" --include='*.{ts,js,py}' . 2>/dev/null | head -30`,
      ],
      { cwd: this.projectDir }
    );
    return r.stdout.split('\n').filter(Boolean).slice(0, 30);
  }

  private async countFiles(): Promise<number> {
    const r = await run(
      'bash',
      [
        '-lc',
        `find . -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \\) -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l`,
      ],
      { cwd: this.projectDir }
    );
    return Number(r.stdout.trim()) || 0;
  }

  private async mapDirectory(): Promise<string> {
    const r = await run(
      'bash',
      [
        '-lc',
        `find . -maxdepth 2 -type d -not -path '*/node_modules*' -not -path '*/.git*' -not -path '*/dist*' -not -path '*/build*' | sort`,
      ],
      { cwd: this.projectDir }
    );
    return r.stdout.trim();
  }

  private async has(rel: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectDir, rel));
      return true;
    } catch {
      return false;
    }
  }

  private async writeBrain(r: DiscoveryResult): Promise<void> {
    const md = [
      `# Architecture Overview`,
      `_auto-discovered ${new Date().toISOString()}_`,
      '',
      `- Language: ${r.language}`,
      `- Framework: ${r.framework ?? 'unknown'}`,
      `- Test runner: ${r.testRunner ?? 'unknown'}`,
      `- Build command: ${r.buildCommand ?? 'unknown'}`,
      `- Dev command: ${r.devCommand ?? 'unknown'}`,
      `- Total source files: ${r.totalFiles}`,
      '',
      `## Entry points`,
      ...(r.entryPoints.length ? r.entryPoints.map((e) => `- ${e}`) : ['- none detected']),
      '',
      `## Directory map`,
      '```',
      r.directoryTree || '(empty)',
      '```',
      '',
      `## Routes / endpoints (sample)`,
      '```',
      r.routes.join('\n') || '(none detected)',
      '```',
      '',
      `## Models (sample)`,
      '```',
      r.models.join('\n') || '(none detected)',
      '```',
      '',
      `## External API calls (sample)`,
      '```',
      r.externalCalls.join('\n') || '(none detected)',
      '```',
      '',
    ].join('\n');

    const filePath = path.join(config.brain.dir, 'knowledge', 'architecture.md');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, md);
    this.log.info(`wrote ${filePath}`);
  }
}
