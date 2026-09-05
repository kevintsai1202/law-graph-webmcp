import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_PARTIES, CONTRACT_SCOPES, CONTRACT_OUTPUTS } from '../src/main/resources/static/js/contract.js';
import { normalizeOutputs, outputOptionsFor } from '../src/main/resources/static/js/documents.js';

test('合約常數與 normalizeOutputs 依 mode', () => {
  assert.deepEqual(CONTRACT_PARTIES, ['partyA', 'partyB', 'unknown']);
  assert.deepEqual(CONTRACT_SCOPES, ['commercial', 'labor', 'privacy', 'corporate']);
  assert.deepEqual(CONTRACT_OUTPUTS, ['revised']);
  assert.deepEqual(normalizeOutputs(['graph', 'revised', 'bogus'], 'contract'), ['revised']);
  assert.deepEqual(normalizeOutputs([], 'contract'), []);
  assert.deepEqual(normalizeOutputs([], 'case'), ['graph']);
  assert.deepEqual(outputOptionsFor('contract'), ['revised']);
  assert.equal(outputOptionsFor('case')[0], 'graph');
});
