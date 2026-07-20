import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeech, hashId, clipId } from './voice-hash.js';
import { resolveLine, resolveSpeech, state } from './engine.js';
import { story } from './story.js';

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

test('voice regressions stay fixed for both player genders', () => {
  const dana = story.s2_tasks.beats.find(b => b.speaker === 'dana');
  const bot = story.s7b_botgood.beats.find(b => b.speaker === 'bot');
  const michalHelp = story.s3a_michal.beats.find(b => b.speaker === 'michal');
  const exit = story.s11_exit.beats.find(b => b.speaker === 'michal');

  state.gender = 'm';
  assert.match(resolveSpeech(dana), /אתה אמרת/);
  assert.match(resolveSpeech(bot), /אתה רוצה לנסות/);
  assert.match(resolveSpeech(exit), /כן ואמיתי/);

  state.gender = 'f';
  assert.match(resolveSpeech(dana), /את אמרת/);
  assert.match(resolveSpeech(bot), /את רוצה לנסות/);
  assert.match(resolveSpeech(exit), /כן ואמיתי/);
  assert.doesNotMatch(resolveSpeech(exit), /כנה ואמיתי/);
  assert.match(resolveSpeech(michalHelp), /שֶׁהֵרַמְתְּ יד/);
  assert.match(story.s2_tasks.choices[2].speech, /יוֹרדים לשחק/);
  assert.match(story.s7_bot.choices[2].speech, /^לִסְגּוֹר את הבוט/);
});

test('Dana help scene follows her question before returning to class flow', () => {
  assert.ok(story.s3b_solo.choices?.length >= 3);
  assert.equal(story.s3b_solo.choices[0].to, 's3b_danahelp');
  assert.equal(story.s3b_solo.choices[1].to, 'BR_dana');
  assert.equal(story.BR_dana.breathing, true);
  assert.equal(story.BR_dana.to, 's3b_danabreathe');
  assert.equal(story.s3b_danahelp.continue, 's4_dana');
  assert.equal(story.s3b_danabreathe.continue, 's4_dana');
  assert.match(story.s3b_danabreathe.beats[0].line, /באמת עזר|פחות לחוץ/);
  assert.doesNotMatch(story.s3b_danabreathe.beats[0].line, /מפרקים את השאלה/);
  assert.equal(story.s3b_danalater.continue, 's4_dana');

  const later = story.s3b_solo.choices[2];
  state.gender = 'm';
  assert.match(resolveSpeech({ speech:later.speech }), /אסביר לָךְ בהפסקה/);
  state.gender = 'f';
  assert.match(resolveSpeech({ speech:later.speech }), /אסביר לָךְ בהפסקה/);
  assert.doesNotMatch(later.speech, /לְךָ/);
});

test('Dana calls the notification idea brilliant only after the player suggests it', () => {
  const beats = story.s5b_pairgood.beats;
  assert.equal(beats[0].speaker, 'you');
  assert.match(beats[0].line, /נכבה התראות בטלפון/);
  assert.equal(beats[1].speaker, 'dana');
  assert.match(beats[1].line, /זה גאוני/);
});

test('the post-mentor inner thought follows the selected player gender', () => {
  const beat = story.s8b_mentorreply.beats.find(item => item.speaker === 'inner');
  state.gender = 'm';
  assert.match(resolveLine(beat), /מרגיש קצת יותר קל/);
  state.gender = 'f';
  assert.match(resolveLine(beat), /מרגישה קצת יותר קל/);
});

test('audio wording matches the displayed wording exactly, apart from niqqud', () => {
  const plain = value => String(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  for (const gender of ['m', 'f']) {
    state.gender = gender;
    for (const [nodeId, node] of Object.entries(story)) {
      for (const [index, choice] of (node.choices || []).entries()) {
        if (!choice.speech) continue;
        assert.equal(
          plain(resolveSpeech({ speech: choice.speech })),
          plain(resolveLine({ line: choice.t })),
          `${nodeId}.choices[${index}] (${gender})`,
        );
      }
      for (const [index, beat] of (node.beats || []).entries()) {
        if (!beat.speech || beat.line.includes('720')) continue;
        assert.equal(
          plain(resolveSpeech(beat)),
          plain(resolveLine(beat)),
          `${nodeId}.beats[${index}] (${gender})`,
        );
      }
    }
  }
});
