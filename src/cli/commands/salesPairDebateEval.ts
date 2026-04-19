import path from 'node:path';
import {
  runFixtureValidation,
  scoreSynthesisFile,
  rubricDocPath,
  defaultEvalScenariosDir,
} from '../../sales/pairDebate/eval/runFixtures.js';
import { scoreRunFromFile } from '../../sales/pairDebate/eval/scoreRun.js';

export async function runPairDebateEvalCli(argv: string[]): Promise<void> {
  const [mode, arg] = argv;
  if (mode === 'validate' || !mode) {
    const r = runFixtureValidation();
    for (const s of r.scenarios) {
      console.log(`${s.ok ? 'OK  ' : 'FAIL'} ${s.id}`);
      for (const e of s.errors) console.log(`      ${e}`);
    }
    console.log('');
    console.log(`scenarios dir: ${defaultEvalScenariosDir()}`);
    console.log(`rubric: ${rubricDocPath()}`);
    process.exit(r.all_ok ? 0 : 1);
  }
  if (mode === 'score-synthesis' && arg) {
    const p = path.resolve(arg);
    const sc = scoreSynthesisFile(p);
    console.log(JSON.stringify({ points: sc.points, max: sc.max, details: sc.details }, null, 2));
    process.exit(0);
  }
  if (mode === 'score-run' && arg) {
    const p = path.resolve(arg);
    const sc = scoreRunFromFile(p);
    console.log(JSON.stringify(sc, null, 2));
    process.exit(0);
  }
  console.error('usage:');
  console.error('  nightshift sales pair-debate-eval validate');
  console.error('  nightshift sales pair-debate-eval score-synthesis <path-to-synthesis.json>');
  console.error('  nightshift sales pair-debate-eval score-run <pair-debate-*-full.json>');
  process.exit(2);
}
