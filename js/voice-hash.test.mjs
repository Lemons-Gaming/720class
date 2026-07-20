import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeech, hashId, clipId } from './voice-hash.js';
import { resolveLine, resolveSpeech, state } from './engine.js';

test('normalizeSpeech strips <em> and collapses whitespace', () => {
  assert.equal(normalizeSpeech('שלום <em>עולם</em>   כאן'), 'שלום עולם כאן');
  assert.equal(normalizeSpeech('  a\n b '), 'a b');
});

test('hashId is deterministic and 8 hex chars', () => {
  const a = hashId('abc'); const b = hashId('abc');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(hashId('abc'), hashId('abd'));
});

test('clipId ignores <em> but depends on speaker and text', () => {
  assert.equal(clipId('michal', 'היי <em>שם</em>'), clipId('michal', 'היי שם'));
  assert.notEqual(clipId('michal', 'היי'), clipId('dana', 'היי'));
});

test('speech overrides pronunciation without changing displayed text', () => {
  const beat = {
    line: 'ברוכים הבאים ל-720. יש לך משימה.',
    speech: 'ברוכים הבאים לשבע מאות וֶעשרים. יש {לְךָ/לָךְ} משימה.',
  };
  state.gender = 'm';
  assert.equal(resolveLine(beat), beat.line);
  assert.match(resolveSpeech(beat), /שבע מאות וֶעשרים.*לְךָ/);
  state.gender = 'f';
  assert.match(resolveSpeech(beat), /שבע מאות וֶעשרים.*לָךְ/);
});

test('speech override follows the reachable flag branch', () => {
  const beat = {
    flag: 'promisedDana',
    line: 'הבטחת לי.',
    speech: '{הִבְטַחְתָּ/הִבְטַחְתְּ} לי.',
    ifFalse: 'מישהו בא?',
  };
  state.gender = 'm';
  state.flags.promisedDana = true;
  assert.equal(resolveSpeech(beat), 'הִבְטַחְתָּ לי.');
  state.flags.promisedDana = false;
  assert.equal(resolveSpeech(beat), 'מישהו בא?');
});
