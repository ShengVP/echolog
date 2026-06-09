// env-utils 纯函数完整覆盖
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, parseEnv, serializeEnv } from '../electron/env-utils';

describe('parseFrontmatter', () => {
  it('parses front matter and body', () => {
    const r = parseFrontmatter(`---\ntitle: hello\nmaturity: 🌳 成熟\n---\n\n正文`);
    expect(r.meta.title).toBe('hello');
    expect(r.meta.maturity).toBe('🌳 成熟');
    expect(r.body).toBe('正文');
  });

  it('strips double-quotes from values', () => {
    const r = parseFrontmatter('---\nfoo: "bar baz"\n---\nbody');
    expect(r.meta.foo).toBe('bar baz');
  });

  it('returns full body when no frontmatter', () => {
    const r = parseFrontmatter('just body');
    expect(r.meta).toEqual({});
    expect(r.body).toBe('just body');
  });

  it('handles empty frontmatter', () => {
    const r = parseFrontmatter('---\n---\n\nbody');
    expect(r.meta).toEqual({});
    expect(r.body).toBe('body');
  });

  it('ignores invalid kv lines in frontmatter', () => {
    const r = parseFrontmatter('---\nvalid: yes\ninvalid line without colon\nother: ok\n---\nx');
    expect(r.meta).toEqual({ valid: 'yes', other: 'ok' });
  });
});

describe('parseEnv', () => {
  it('parses simple K=V', () => {
    expect(parseEnv('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips comments and blank lines', () => {
    expect(parseEnv('# header\n\nFOO=bar\n# more comment\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips both quote styles', () => {
    expect(parseEnv('A="d e"\nB=\'x y\'')).toEqual({ A: 'd e', B: 'x y' });
  });

  it('ignores invalid identifiers', () => {
    expect(parseEnv('lowercase=bad\n123=bad\nVALID=ok')).toEqual({ VALID: 'ok' });
  });

  it('preserves = in values', () => {
    expect(parseEnv('TOKEN=foo=bar=baz')).toEqual({ TOKEN: 'foo=bar=baz' });
  });

  it('handles empty values', () => {
    expect(parseEnv('EMPTY=\nFOO=bar')).toEqual({ EMPTY: '', FOO: 'bar' });
  });
});

describe('serializeEnv', () => {
  it('groups identity keys', () => {
    const out = serializeEnv({ USER_NAME: 'Bill', USER_IDENTITY: 'engineer' });
    expect(out).toContain('# 用户身份');
    expect(out).toContain('USER_NAME=Bill');
    expect(out).toContain('USER_IDENTITY=engineer');
  });

  it('groups LLM keys', () => {
    const out = serializeEnv({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-x', LLM_TEXT_MODEL: 'gpt' });
    expect(out).toContain('# LLM Provider');
    expect(out).toMatch(/LLM_PROVIDER=openai/);
  });

  it('groups module flags + weekly config in their own sections', () => {
    const out = serializeEnv({
      ENABLE_TICKTICK: 'false',
      ENABLE_DRAFTS: 'true',
      WEEKLY_RANGE_DAYS: '7',
      WEEKLY_RANGE_END_OFFSET: '-1',
    });
    expect(out).toContain('# 功能开关');
    expect(out).toContain('ENABLE_TICKTICK=false');
    expect(out).toContain('# 周报配置');
    expect(out).toContain('WEEKLY_RANGE_DAYS=7');
    expect(out).toContain('WEEKLY_RANGE_END_OFFSET=-1');
  });

  it('quotes values with spaces / hash', () => {
    const out = serializeEnv({ USER_NAME: 'Bill Li', NOTE: 'a # b' });
    expect(out).toContain('USER_NAME="Bill Li"');
    expect(out).toContain('NOTE="a # b"');
  });

  it('unknown keys go to leftover section', () => {
    const out = serializeEnv({ CUSTOM_OPT: 'foo' });
    expect(out).toContain('# 其它');
    expect(out).toContain('CUSTOM_OPT=foo');
  });

  it('skips empty sections', () => {
    const out = serializeEnv({ USER_NAME: 'Bill' });
    expect(out).toContain('# 用户身份');
    expect(out).not.toContain('# 飞书');
    expect(out).not.toContain('# LLM Provider');
  });

  it('round-trips through parseEnv with all section types', () => {
    const original = {
      USER_NAME: 'Bill',
      FEISHU_APP_ID: 'cli_abc',
      LLM_PROVIDER: 'ollama',
      ENABLE_TICKTICK: 'false',
      WEEKLY_RANGE_DAYS: '14',
      DIARY_PROMPT_VERSION: 'v1_1',
      TG_BOT_TOKEN: 'token:secret',
    };
    const parsed = parseEnv(serializeEnv(original));
    for (const [k, v] of Object.entries(original)) {
      expect(parsed[k]).toBe(v);
    }
  });

  it('handles header prefix', () => {
    const out = serializeEnv({ FOO: 'bar' } as any, '# header comment');
    expect(out.startsWith('# header comment')).toBe(true);
  });
});
