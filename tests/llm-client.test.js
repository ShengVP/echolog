// bot 端：lib/llm.js 抽象层单测（不打 ollama，只测路由 + describe）
const assert = require('node:assert');

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

t('default provider is ollama', () => {
  withEnv({ LLM_PROVIDER: undefined }, () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    assert.strictEqual(llm.PROVIDER, 'ollama');
    assert.strictEqual(llm.describe().provider, 'ollama');
  });
});

t('explicit openai provider', () => {
  withEnv({
    LLM_PROVIDER: 'openai',
    LLM_API_BASE: 'https://api.deepseek.com/v1',
    LLM_API_KEY: 'sk-test',
  }, () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    assert.strictEqual(llm.PROVIDER, 'openai');
    const d = llm.describe();
    assert.strictEqual(d.provider, 'openai');
    assert.strictEqual(d.api_base, 'https://api.deepseek.com/v1');
    assert.strictEqual(d.has_key, true);
  });
});

t('describe reports has_key=false when missing', () => {
  withEnv({
    LLM_PROVIDER: 'openai',
    LLM_API_BASE: 'https://example.com/v1',
    LLM_API_KEY: '',
  }, () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    assert.strictEqual(llm.describe().has_key, false);
  });
});

t('unknown provider throws on chat', async () => {
  withEnv({ LLM_PROVIDER: 'nonsense' }, async () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    let threw = false;
    try {
      await llm.chat({ model: 'x', messages: [] });
    } catch (err) {
      assert.ok(/未知 LLM_PROVIDER/.test(err.message));
      threw = true;
    }
    assert.ok(threw, 'should have thrown');
  });
});

t('anthropic provider routing + describe 默认 api_base', () => {
  withEnv({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'sk-ant-test', LLM_API_BASE: undefined }, () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    assert.strictEqual(llm.PROVIDER, 'anthropic');
    const d = llm.describe();
    assert.strictEqual(d.provider, 'anthropic');
    assert.strictEqual(d.api_base, 'https://api.anthropic.com');
    assert.strictEqual(d.has_key, true);
  });
});

t('anthropic embed 抛友好错误（无 embedding API）', async () => {
  await withEnv({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'sk-ant-test' }, async () => {
    delete require.cache[require.resolve('../lib/llm')];
    const llm = require('../lib/llm');
    let threw = false;
    try { await llm.embed({ model: 'x', input: 'hi' }); }
    catch (err) { assert.ok(/embedding API/.test(err.message)); threw = true; }
    assert.ok(threw, 'anthropic embed 应抛错');
  });
});

t('toAnthropicMessages: system 抽顶层 + 图片转 base64 image block', () => {
  delete require.cache[require.resolve('../lib/llm')];
  const llm = require('../lib/llm');
  const { system, messages } = llm.toAnthropicMessages([
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'describe this', images: ['/9j/abc'] },
  ]);
  assert.strictEqual(system, 'be terse');
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].role, 'user');
  const parts = messages[0].content;
  assert.ok(Array.isArray(parts), 'content 应是 block 数组');
  const img = parts.find(p => p.type === 'image');
  assert.ok(img, '应有 image block');
  assert.strictEqual(img.source.type, 'base64');
  assert.strictEqual(img.source.media_type, 'image/jpeg'); // /9j/ → jpeg
  assert.strictEqual(img.source.data, '/9j/abc');
  assert.ok(parts.find(p => p.type === 'text' && p.text === 'describe this'), '应有 text block');
});

t('anthropicSamplingAllowed: Opus 4.7/4.8 关、其余开', () => {
  delete require.cache[require.resolve('../lib/llm')];
  const llm = require('../lib/llm');
  assert.strictEqual(llm.anthropicSamplingAllowed('claude-opus-4-8'), false);
  assert.strictEqual(llm.anthropicSamplingAllowed('claude-opus-4-7'), false);
  assert.strictEqual(llm.anthropicSamplingAllowed('claude-sonnet-4-6'), true);
  assert.strictEqual(llm.anthropicSamplingAllowed('deepseek-chat'), true);
});

// runner — 支持 async tests
(async () => {
  let pass = 0, fail = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      pass++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
