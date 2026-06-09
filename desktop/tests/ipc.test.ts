// 测试 parseFrontmatter / parseEnv / serializeEnv 三个纯字符串处理函数
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, parseEnv, serializeEnv } from '../electron/env-utils';

describe('parseFrontmatter', () => {
  it('parses front matter and body', () => {
    const input = `---
title: hello
maturity: 🌳 成熟
---

正文内容
第二行`;
    const r = parseFrontmatter(input);
    expect(r.meta.title).toBe('hello');
    expect(r.meta.maturity).toBe('🌳 成熟');
    expect(r.body).toContain('正文内容');
    expect(r.body).toContain('第二行');
  });

  it('strips quotes from quoted values', () => {
    const r = parseFrontmatter('---\nfoo: "bar baz"\n---\nbody');
    expect(r.meta.foo).toBe('bar baz');
  });

  it('returns full body when no frontmatter', () => {
    const r = parseFrontmatter('just body content');
    expect(r.meta).toEqual({});
    expect(r.body).toBe('just body content');
  });
});

describe('parseEnv', () => {
  it('parses simple K=V lines', () => {
    const env = parseEnv('FOO=bar\nBAZ=qux');
    expect(env).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips comments and blank lines', () => {
    const env = parseEnv('# comment\n\nFOO=bar\n  # indented comment ignored too? no, indented not stripped');
    expect(env.FOO).toBe('bar');
  });

  it('strips quotes', () => {
    const env = parseEnv('FOO="bar baz"\nQUX=\'single\'');
    expect(env.FOO).toBe('bar baz');
    expect(env.QUX).toBe('single');
  });

  it('ignores invalid lines', () => {
    const env = parseEnv('not-a-pair\nFOO=ok');
    expect(env).toEqual({ FOO: 'ok' });
  });
});

describe('serializeEnv', () => {
  it('groups keys into known sections', () => {
    const out = serializeEnv({
      USER_NAME: 'Bill',
      FEISHU_APP_ID: 'cli_xxx',
      LLM_PROVIDER: 'ollama',
    });
    expect(out).toContain('# 用户身份');
    expect(out).toContain('USER_NAME=Bill');
    expect(out).toContain('# 飞书');
    expect(out).toContain('FEISHU_APP_ID=cli_xxx');
    expect(out).toContain('# LLM Provider');
    expect(out).toContain('LLM_PROVIDER=ollama');
  });

  it('quotes values with spaces or #', () => {
    const out = serializeEnv({ USER_NAME: 'Bill Li', USER_IDENTITY: 'CEO of #1 co' });
    expect(out).toContain('USER_NAME="Bill Li"');
    expect(out).toContain('USER_IDENTITY="CEO of #1 co"');
  });

  it('puts unknown keys in 其它 section', () => {
    const out = serializeEnv({ MY_CUSTOM_KEY: 'value' });
    expect(out).toContain('# 其它');
    expect(out).toContain('MY_CUSTOM_KEY=value');
  });

  it('skips empty sections', () => {
    const out = serializeEnv({ USER_NAME: 'Bill' });
    expect(out).toContain('# 用户身份');
    expect(out).not.toContain('# 飞书'); // FEISHU_* not present → section skipped
  });

  it('round-trips through parseEnv', () => {
    const original = {
      USER_NAME: 'Bill',
      LLM_PROVIDER: 'openai',
      LLM_API_KEY: 'sk-xxx',
      FEISHU_APP_ID: 'cli_abc',
    };
    const text = serializeEnv(original);
    const parsed = parseEnv(text);
    for (const [k, v] of Object.entries(original)) {
      expect(parsed[k]).toBe(v);
    }
  });
});
