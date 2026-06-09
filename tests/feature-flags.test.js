// bot 端：feature-flags 单测
// 跑：node tests/feature-flags.test.js
//
// 不引 vitest/jest，纯 node assert —— bot 这边没有测试框架，保持轻量

const assert = require('node:assert');
const flags = require('../lib/feature-flags');

const tests = [];
function t(name, fn) { tests.push({ name, fn }); }

// 备份 env，每个 test 跑完恢复
function withEnv(envVars, fn) {
  const backup = {};
  for (const k of Object.keys(envVars)) {
    backup[k] = process.env[k];
    if (envVars[k] === undefined) delete process.env[k];
    else process.env[k] = envVars[k];
  }
  try { fn(); }
  finally {
    for (const k of Object.keys(envVars)) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  }
}

t('enableTickTick defaults true', () => {
  withEnv({ ENABLE_TICKTICK: undefined }, () => {
    assert.strictEqual(flags.enableTickTick(), true);
  });
});

t('enableTickTick reads false/0/no/off as false', () => {
  for (const v of ['false', 'FALSE', '0', 'no', 'off', 'OFF']) {
    withEnv({ ENABLE_TICKTICK: v }, () => {
      assert.strictEqual(flags.enableTickTick(), false, `value="${v}" should be false`);
    });
  }
});

t('enableTickTick reads true/1/yes/on as true', () => {
  for (const v of ['true', 'TRUE', '1', 'yes', 'on']) {
    withEnv({ ENABLE_TICKTICK: v }, () => {
      assert.strictEqual(flags.enableTickTick(), true, `value="${v}" should be true`);
    });
  }
});

t('invalid values fall back to default', () => {
  withEnv({ ENABLE_TICKTICK: 'maybe' }, () => {
    assert.strictEqual(flags.enableTickTick(), true);
  });
});

t('all flag functions default to true', () => {
  withEnv({
    ENABLE_TICKTICK: undefined,
    ENABLE_DRAFTS: undefined,
    ENABLE_URL_ENRICH: undefined,
    ENABLE_ASR: undefined,
    ENABLE_EMBEDDINGS: undefined,
  }, () => {
    assert.strictEqual(flags.enableTickTick(), true);
    assert.strictEqual(flags.enableDrafts(), true);
    assert.strictEqual(flags.enableUrlEnrich(), true);
    assert.strictEqual(flags.enableAsr(), true);
    assert.strictEqual(flags.enableEmbeddings(), true);
  });
});

t('weeklyRangeDays defaults 7', () => {
  withEnv({ WEEKLY_RANGE_DAYS: undefined }, () => {
    assert.strictEqual(flags.weeklyRangeDays(), 7);
  });
});

t('weeklyRangeDays clamps to [1, 60]', () => {
  withEnv({ WEEKLY_RANGE_DAYS: '0' }, () => assert.strictEqual(flags.weeklyRangeDays(), 1));
  withEnv({ WEEKLY_RANGE_DAYS: '-3' }, () => assert.strictEqual(flags.weeklyRangeDays(), 1));
  withEnv({ WEEKLY_RANGE_DAYS: '999' }, () => assert.strictEqual(flags.weeklyRangeDays(), 60));
  withEnv({ WEEKLY_RANGE_DAYS: '14' }, () => assert.strictEqual(flags.weeklyRangeDays(), 14));
});

t('weeklyEndOffset defaults 0 and accepts negatives', () => {
  withEnv({ WEEKLY_RANGE_END_OFFSET: undefined }, () => assert.strictEqual(flags.weeklyEndOffset(), 0));
  withEnv({ WEEKLY_RANGE_END_OFFSET: '-1' }, () => assert.strictEqual(flags.weeklyEndOffset(), -1));
  withEnv({ WEEKLY_RANGE_END_OFFSET: '3' }, () => assert.strictEqual(flags.weeklyEndOffset(), 3));
});

t('weeklyEndOffset invalid falls back to 0', () => {
  withEnv({ WEEKLY_RANGE_END_OFFSET: 'abc' }, () => assert.strictEqual(flags.weeklyEndOffset(), 0));
});

// runner
let pass = 0, fail = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    fail++;
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
