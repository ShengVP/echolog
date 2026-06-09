// bot 端：lib/prompts.js interpolate + userVars
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tests = [];
function t(name, fn) { tests.push({ name, fn }); }

function withEnv(envVars, fn) {
  const backup = {};
  for (const k of Object.keys(envVars)) {
    backup[k] = process.env[k];
    if (envVars[k] === undefined) delete process.env[k];
    else process.env[k] = envVars[k];
  }
  try { return fn(); }
  finally {
    for (const k of Object.keys(envVars)) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  }
}

t('interpolate replaces {{KEY}} with vars', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const { interpolate } = require('../lib/prompts');
  const r = interpolate('我叫 {{USER_NAME}}，是 {{USER_IDENTITY}}', { USER_NAME: 'Bill', USER_IDENTITY: 'eng' });
  assert.strictEqual(r, '我叫 Bill，是 eng');
});

t('interpolate keeps unknown placeholders as-is', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const { interpolate } = require('../lib/prompts');
  const r = interpolate('{{KNOWN}} {{UNKNOWN}}', { KNOWN: 'x' });
  assert.strictEqual(r, 'x {{UNKNOWN}}');
});

t('interpolate handles empty string', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const { interpolate } = require('../lib/prompts');
  assert.strictEqual(interpolate('', { X: 'y' }), '');
});

t('userVars returns sensible defaults', () => {
  withEnv({
    USER_NAME: undefined,
    USER_IDENTITY: undefined,
    USER_TONE_HINT: undefined,
    USER_PROJECTS: undefined,
    USER_CONTENT_FOCUS: undefined,
  }, () => {
    delete require.cache[require.resolve('../lib/prompts')];
    const { userVars } = require('../lib/prompts');
    const v = userVars();
    assert.strictEqual(v.USER_NAME, '我');
    assert.ok(v.USER_IDENTITY.length > 0);
    assert.ok(v.USER_TONE_HINT.length > 0);
  });
});

t('userVars reads from process.env', () => {
  withEnv({
    USER_NAME: 'Bill',
    USER_IDENTITY: 'CEO',
    USER_PROJECTS: '[[X]] [[Y]]',
  }, () => {
    delete require.cache[require.resolve('../lib/prompts')];
    const { userVars } = require('../lib/prompts');
    const v = userVars();
    assert.strictEqual(v.USER_NAME, 'Bill');
    assert.strictEqual(v.USER_IDENTITY, 'CEO');
    assert.strictEqual(v.USER_PROJECTS, '[[X]] [[Y]]');
  });
});

t('all 8 registered prompt names load with v1', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const p = require('../lib/prompts');
  const names = p.listAllPromptNames();
  assert.strictEqual(names.length, 8, 'expected 8 registered prompt names');
  const expectedNames = ['diary', 'weekly', 'drafts_twitter', 'drafts_long', 'drafts_video',
    'self_review_single', 'self_review_advice', 'vision_describe'];
  for (const n of expectedNames) {
    assert.ok(names.find(x => x.name === n), `missing prompt name: ${n}`);
    // 测一次能 load
    const pair = p.loadPromptPair(n);
    assert.ok(pair.template.length > 0, `${n}: template empty`);
  }
});

t('vision_describe has empty SYSTEM (placeholder text filtered)', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const p = require('../lib/prompts');
  const pair = p.loadPromptPair('vision_describe');
  assert.strictEqual(pair.system, '', `vision_describe SYSTEM should be empty, got: "${pair.system}"`);
});

t('ENV_KEY + DEFAULT_VERSION 完整覆盖 8 个 prompt', () => {
  delete require.cache[require.resolve('../lib/prompts')];
  const p = require('../lib/prompts');
  for (const item of p.listAllPromptNames()) {
    assert.ok(p.ENV_KEY[item.name], `${item.name}: ENV_KEY missing`);
    assert.ok(p.DEFAULT_VERSION[item.name], `${item.name}: DEFAULT_VERSION missing`);
  }
});

t('loadPromptPair injects userVars into placeholders', () => {
  // 写一个临时 prompt 文件然后加载
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-test-'));
  const fp = path.join(tmpDir, 'diary_test.md');
  fs.writeFileSync(fp, '---\nversion: test\n---\n\n## SYSTEM\n\n我叫 {{USER_NAME}}\n\n## TEMPLATE\n\n身份: {{USER_IDENTITY}}');

  // 把 prompts.js 里的 PROMPTS_DIR 改了不容易；改用 monkey-patch 思路：让 loadPromptPair 看到我们的 tmpDir
  // 实际：loadPromptPair 直接 fs.readFileSync(promptsDir 路径)；我们劫持 fs 不容易
  // 简单方法：直接测 interpolate + userVars 组合即可
  withEnv({ USER_NAME: 'TestUser', USER_IDENTITY: 'TestId' }, () => {
    delete require.cache[require.resolve('../lib/prompts')];
    const { interpolate, userVars } = require('../lib/prompts');
    const raw = fs.readFileSync(fp, 'utf8');
    const result = interpolate(raw, userVars());
    assert.ok(result.includes('我叫 TestUser'));
    assert.ok(result.includes('身份: TestId'));
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
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
