import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Monaco 在 jsdom 里跑不了（依赖 Worker / Canvas）—— mock 成简单 textarea
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => {
    // @ts-ignore React 在测试环境用全局
    const React = require('react');
    return React.createElement('textarea', {
      role: 'textbox',
      value,
      onChange: (e: any) => onChange?.(e.target.value),
      'data-testid': 'monaco-mock',
    });
  },
}));

// jsdom 在 vitest 环境下的 localStorage 实现不稳定 —— 强制用 Storage 接口的简单实现
class MemStorage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  key(i: number) { return Object.keys(this.store)[i] ?? null; }
  getItem(k: string) { return this.store[k] ?? null; }
  setItem(k: string, v: string) { this.store[k] = String(v); }
  removeItem(k: string) { delete this.store[k]; }
  clear() { this.store = {}; }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemStorage(), configurable: true, writable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: (globalThis as any).localStorage, configurable: true, writable: true });
}

// Mock window.api（preload 在测试环境没注入）
(globalThis as any).window.api = {
  listDates: async () => ['2026-05-27', '2026-05-26'],
  readDay: async (date: string) => ({
    rawLogs: `# ${date}\n\n**10:00:00** 测试内容`,
    diaries: [],
    assets: [],
  }),
  readAssetDataUrl: async () => null,
  listNotes: async () => [],
  listDrafts: async () => [],
  readNote: async () => null,
  readDraft: async () => null,
  readEnv: async () => ({ USER_NAME: '测试', LLM_PROVIDER: 'ollama' }),
  writeEnv: async () => ({ ok: true }),
  listPromptVersions: async () => ['v1', 'v1_1'],
  readPrompt: async () => '## SYSTEM\n\nsystem text\n\n## TEMPLATE\n\ntemplate text',
  writePrompt: async () => ({ ok: true, file: 'prompts/diary_v1.md' }),
  listPromptRegistry: async () => [
    { name: 'diary',             label: '日记',            description: '每日 /diary 命令',         envKey: 'DIARY_PROMPT_VERSION',             defaultVersion: 'v1', versions: ['v1', 'v1_1'] },
    { name: 'weekly',            label: '周报',            description: '/week 命令',                envKey: 'WEEKLY_PROMPT_VERSION',            defaultVersion: 'v1', versions: ['v1'] },
    { name: 'drafts_twitter',    label: '草稿 · 推特串',    description: '/draft <id>',               envKey: 'DRAFTS_TWITTER_PROMPT_VERSION',    defaultVersion: 'v1', versions: ['v1'] },
    { name: 'drafts_long',       label: '草稿 · 公众号长文', description: '/draft <id> --long',        envKey: 'DRAFTS_LONG_PROMPT_VERSION',       defaultVersion: 'v1', versions: ['v1'] },
    { name: 'drafts_video',      label: '草稿 · 短视频',    description: '/draft <id> --video',       envKey: 'DRAFTS_VIDEO_PROMPT_VERSION',      defaultVersion: 'v1', versions: ['v1'] },
    { name: 'self_review_single',label: '自审 · 单日审稿',  description: 'self-review',               envKey: 'SELF_REVIEW_SINGLE_PROMPT_VERSION',defaultVersion: 'v1', versions: ['v1'] },
    { name: 'self_review_advice',label: '自审 · 改 prompt 建议', description: 'self-review 末尾',   envKey: 'SELF_REVIEW_ADVICE_PROMPT_VERSION',defaultVersion: 'v1', versions: ['v1'] },
    { name: 'vision_describe',   label: '视觉描述',         description: '解析图片',                  envKey: 'VISION_DESCRIBE_PROMPT_VERSION',   defaultVersion: 'v1', versions: ['v1'] },
  ],
  getBotStatus: async () => ({ running: false }),
  runDoctor: async () => ({ stdout: 'mock doctor output', stderr: '', code: 0 }),
  getRatings: async () => ({ total: 0, avg: '0.0', byScore: {}, recent: [] }),
  getIndexStats: async () => ({ model: '-', totalChunks: 0, days: 0, earliest: null, latest: null }),
  searchKeyword: async () => [],
  searchSemantic: async () => ({ ok: true, hits: [] }),
  botStart: async () => ({ ok: true, output: 'started' }),
  botStop: async () => ({ ok: true, output: 'stopped' }),
  botRestart: async () => ({ ok: true, output: 'restarted' }),
  tailLog: async () => 'mock log lines',
  pingLlm: async () => ({ ok: true, provider: 'ollama', model: 'qwen3.5:9b', reply: 'pong', durationSec: '0.3' }),
  getProjectRoot: async () => '/tmp/test',
  openInFinder: async () => {},
  openExternal: async () => {},
};

// appEvents
(globalThis as any).window.appEvents = {
  onNavigate: () => () => {},
};
