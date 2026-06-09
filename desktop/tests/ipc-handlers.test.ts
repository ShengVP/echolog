// IPC handlers 集成测试 —— 创建临时 fixture vault，让 registerIpcHandlers 跑真实文件 IO
//
// 跳过依赖 electron 真实进程的 channel（bot:start/stop, llm:ping），那些走 child_process exec，
// 需要全栈环境，留给 e2e。
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerIpcHandlers } from '../electron/ipc';

// Mock electron 模块（IPC handler 只用 shell.openExternal/showItemInFolder，简单 stub）
vi.mock('electron', () => ({
  shell: { showItemInFolder: vi.fn(), openExternal: vi.fn() },
}));

// 简易 IpcMain 桩 —— 把 handle('channel', fn) 攒到 map 里，测试时直接调
function makeIpcMain() {
  const handlers = new Map<string, (e: any, ...args: any[]) => any>();
  return {
    handle: (channel: string, fn: any) => handlers.set(channel, fn),
    invoke: (channel: string, ...args: any[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`no handler for ${channel}`);
      return fn({}, ...args);
    },
    handlers,
  };
}

let tmpRoot: string;
let vaultDir: string;
let ipc: ReturnType<typeof makeIpcMain>;

beforeAll(() => {
  // 1) 建一个临时 project root
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echolog-test-'));
  vaultDir = path.join(tmpRoot, 'Daily_Vault');
  fs.mkdirSync(vaultDir, { recursive: true });

  // 2) 注入 fixture：两天的 raw_logs + diary + 一个 Note
  const d1 = path.join(vaultDir, '2026-05-26');
  const d2 = path.join(vaultDir, '2026-05-27');
  fs.mkdirSync(path.join(d1, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(d2, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(d1, '01_raw_logs.md'), `# 2026-05-26\n\n**10:00:00** 测试关键字 飞书 bot\n`);
  fs.writeFileSync(path.join(d2, '01_raw_logs.md'), `# 2026-05-27\n\n**14:00:00** 另一天的 飞书 内容\n`);
  fs.writeFileSync(path.join(d2, '02_diary_v1.md'), `---\nversion: 1\n---\n\n# 日记\n\n这是一份测试 飞书 日记\n`);
  fs.writeFileSync(path.join(d2, '02_diary_v2.md'), `---\nversion: 2\n---\n\n# 日记 v2\n`);
  fs.writeFileSync(path.join(d2, 'assets', 'test.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  // Notes
  const notesDir = path.join(vaultDir, 'Notes');
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(path.join(notesDir, '2026-05-27_test-note.md'), `---\ntitle: 测试选题\nmaturity: 🌳 成熟\ncategory: 工程师\ncreated: 2026-05-27\n---\n\n正文`);
  // Drafts
  const draftsDir = path.join(vaultDir, 'Drafts');
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.writeFileSync(path.join(draftsDir, '2026-05-27_twitter_测试.md'), `---\nformat: twitter\nsource_title: "测试选题"\nsource_date: 2026-05-27\ngenerated_at: "2026-05-27 14:00:00"\n---\n\n推文内容`);

  // 3) prompts 目录
  fs.mkdirSync(path.join(tmpRoot, 'prompts'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpRoot, 'prompts', 'diary_v1.md'),
    `---\ntype: diary-prompt\nversion: v1\n---\n\n## SYSTEM\n\n系统提示\n\n## TEMPLATE\n\n模板`
  );

  // 4) .env
  fs.writeFileSync(path.join(tmpRoot, '.env'), `USER_NAME=测试\nFEISHU_APP_ID=cli_test\n`);

  // 5) ratings
  fs.writeFileSync(path.join(tmpRoot, '.diary_ratings.jsonl'),
    JSON.stringify({ date: '2026-05-26', version: '1', score: 5, comment: 'good' }) + '\n' +
    JSON.stringify({ date: '2026-05-27', version: '2', score: 3, comment: 'meh' }) + '\n'
  );

  // 6) index
  fs.mkdirSync(path.join(vaultDir, '_index'), { recursive: true });
  fs.writeFileSync(path.join(vaultDir, '_index', 'meta.json'), JSON.stringify({ model: 'bge', version: 1 }));
  fs.writeFileSync(path.join(vaultDir, '_index', 'embeddings.jsonl'),
    JSON.stringify({ id: 'a', date: '2026-05-26', time: '10:00:00', text: 'foo', embedding: [0.1, 0.2] }) + '\n'
  );

  ipc = makeIpcMain();
  registerIpcHandlers(ipc as any, tmpRoot);
});

afterAll(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('vault IPC', () => {
  it('listDates returns dates sorted desc', async () => {
    const r = await ipc.invoke('vault:listDates');
    expect(r).toEqual(['2026-05-27', '2026-05-26']);
  });

  it('readDay returns raw_logs + diaries + assets', async () => {
    const r = await ipc.invoke('vault:readDay', '2026-05-27');
    expect(r.rawLogs).toContain('另一天的');
    expect(r.diaries).toHaveLength(2);
    expect(r.diaries[0].version).toBe(1);
    expect(r.diaries[1].version).toBe(2);
    expect(r.assets).toEqual(['test.jpg']);
  });

  it('readDay returns empty for non-existent date', async () => {
    const r = await ipc.invoke('vault:readDay', '1999-01-01');
    expect(r.rawLogs).toBeNull();
    expect(r.diaries).toEqual([]);
    expect(r.assets).toEqual([]);
  });

  it('readAssetDataUrl returns data URL for jpg', async () => {
    const r = await ipc.invoke('vault:readAssetDataUrl', '2026-05-27/assets/test.jpg');
    expect(r).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('readAssetDataUrl blocks path traversal', async () => {
    const r = await ipc.invoke('vault:readAssetDataUrl', '../../../etc/passwd');
    expect(r).toBeNull();
  });

  it('readAssetDataUrl returns null for missing file', async () => {
    const r = await ipc.invoke('vault:readAssetDataUrl', '2026-05-27/assets/missing.jpg');
    expect(r).toBeNull();
  });
});

describe('drafts IPC', () => {
  it('listNotes returns notes with parsed metadata', async () => {
    const r = await ipc.invoke('drafts:listNotes');
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe('测试选题');
    expect(r[0].maturity).toBe('🌳 成熟');
    expect(r[0].category).toBe('工程师');
  });

  it('listDrafts returns drafts with metadata', async () => {
    const r = await ipc.invoke('drafts:listDrafts');
    expect(r).toHaveLength(1);
    expect(r[0].format).toBe('twitter');
    expect(r[0].sourceTitle).toBe('测试选题');
  });

  it('readNote returns content', async () => {
    const r = await ipc.invoke('drafts:readNote', '2026-05-27_test-note.md');
    expect(r).toContain('正文');
  });

  it('readNote returns null for missing file', async () => {
    expect(await ipc.invoke('drafts:readNote', 'missing.md')).toBeNull();
  });
});

describe('config IPC', () => {
  it('readEnv returns parsed env', async () => {
    const r = await ipc.invoke('config:readEnv');
    expect(r.USER_NAME).toBe('测试');
    expect(r.FEISHU_APP_ID).toBe('cli_test');
  });

  it('writeEnv backs up old file + writes new', async () => {
    const r = await ipc.invoke('config:writeEnv', { USER_NAME: 'NewName', LLM_PROVIDER: 'openai' });
    expect(r.ok).toBe(true);
    // 备份文件应该存在
    const backups = fs.readdirSync(tmpRoot).filter(f => f.startsWith('.env.backup-'));
    expect(backups.length).toBeGreaterThan(0);
    // 新内容
    const newContent = fs.readFileSync(path.join(tmpRoot, '.env'), 'utf8');
    expect(newContent).toContain('USER_NAME=NewName');
    expect(newContent).toContain('LLM_PROVIDER=openai');
  });

  it('listPromptVersions returns versions', async () => {
    const r = await ipc.invoke('config:listPromptVersions', 'diary');
    expect(r).toContain('v1');
  });

  it('readPrompt returns content', async () => {
    const r = await ipc.invoke('config:readPrompt', 'diary', 'v1');
    expect(r).toContain('## SYSTEM');
    expect(r).toContain('## TEMPLATE');
  });

  it('writePrompt rejects content without ## SYSTEM/TEMPLATE', async () => {
    const r = await ipc.invoke('config:writePrompt', 'diary', 'bad', '随便');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/SYSTEM|TEMPLATE/);
  });

  it('writePrompt rejects invalid version name', async () => {
    const r = await ipc.invoke('config:writePrompt', 'diary', 'has spaces', '## SYSTEM\nx\n## TEMPLATE\ny');
    expect(r.ok).toBe(false);
  });

  it('writePrompt creates new version + backs up existing', async () => {
    // 创建新
    const r1 = await ipc.invoke('config:writePrompt', 'diary', 'v2', '## SYSTEM\nA\n## TEMPLATE\nB');
    expect(r1.ok).toBe(true);
    // 覆盖
    const r2 = await ipc.invoke('config:writePrompt', 'diary', 'v2', '## SYSTEM\nA2\n## TEMPLATE\nB2');
    expect(r2.ok).toBe(true);
    // 备份应该存在
    const backups = fs.readdirSync(path.join(tmpRoot, 'prompts')).filter(f => f.includes('.backup-'));
    expect(backups.length).toBeGreaterThan(0);
  });
});

describe('search IPC', () => {
  it('searchKeyword finds hits across days', async () => {
    const r = await ipc.invoke('search:keyword', '飞书', { includeDiaries: true });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.every((h: any) => h.snippets.length > 0)).toBe(true);
  });

  it('searchKeyword filters by includeDiaries', async () => {
    const r = await ipc.invoke('search:keyword', '飞书', { includeDiaries: false });
    expect(r.every((h: any) => h.type === 'raw')).toBe(true);
  });

  it('searchKeyword rejects short queries', async () => {
    const r = await ipc.invoke('search:keyword', 'a');
    expect(r).toEqual([]);
  });

  it('searchKeyword returns empty when no match', async () => {
    const r = await ipc.invoke('search:keyword', '完全不存在的关键词xyz123');
    expect(r).toEqual([]);
  });
});

describe('status IPC', () => {
  it('getRatings parses jsonl', async () => {
    const r = await ipc.invoke('status:getRatings');
    expect(r.total).toBe(2);
    expect(parseFloat(r.avg)).toBeCloseTo(4.0, 1);
    expect(r.byScore[5]).toBe(1);
    expect(r.byScore[3]).toBe(1);
  });

  it('getIndexStats reads meta + jsonl', async () => {
    const r = await ipc.invoke('status:getIndexStats');
    expect(r.model).toBe('bge');
    expect(r.totalChunks).toBe(1);
    expect(r.days).toBe(1);
  });

  it('getBotStatus returns a status object', async () => {
    const r = await ipc.invoke('status:getBotStatus');
    expect(typeof r.running).toBe('boolean');
    // 不 assert 具体 running 值 —— 测试机器可能确实在跑 bot
    if (r.running) {
      expect(typeof r.pid).toBe('number');
    }
  });
});

describe('meta IPC', () => {
  it('getProjectRoot returns the root we registered with', async () => {
    expect(await ipc.invoke('meta:getProjectRoot')).toBe(tmpRoot);
  });
});
