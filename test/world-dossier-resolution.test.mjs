import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  takeDossierSourceFromArgv,
  defaultDossierSourceFromEnv,
  provenanceFromLoadedWorldFile,
} from '../dist/sales/world/worldDossierResolution.js';

test('takeDossierSourceFromArgv strips --source and applies override', () => {
  const { source, argv } = takeDossierSourceFromArgv(['--deal', 'x', '--source', 'crm', '--rounds', '2']);
  assert.equal(source, 'crm');
  assert.deepEqual(argv, ['--deal', 'x', '--rounds', '2']);
});

test('provenanceFromLoadedWorldFile: crm_snapshot vs world_only', () => {
  assert.equal(provenanceFromLoadedWorldFile({ accounts: [], contacts: [], deals: [], activities: [] }), 'world_only');
  assert.equal(
    provenanceFromLoadedWorldFile({
      source: 'crm_snapshot',
      accounts: [],
      contacts: [],
      deals: [],
      activities: [],
    }),
    'crm_snapshot'
  );
});

test('defaultDossierSourceFromEnv is a function', () => {
  assert.equal(typeof defaultDossierSourceFromEnv(), 'string');
});
