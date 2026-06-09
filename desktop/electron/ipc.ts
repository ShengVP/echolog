// IPC handlers —— 把 lib/* 重用进来，把 vault / .env / doctor 等能力桥接到 renderer
//
// 设计原则：主进程做所有 IO；renderer 拿 JSON / 字符串。
// 不直接复用 lib/*.js 的代码（防止改坏 bot 主流程），而是用 require 调用现成函数。
import type { IpcMain } from 'electron';
import { shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { parseFrontmatter, parseEnv, serializeEnv } from './env-utils';

const execAsync = promisify(exec);

export function registerIpcHandlers(ipcMain: IpcMain, projectRoot: string) {
  const vaultDir = path.join(projectRoot, 'Daily_Vault');
  const envFile = path.join(projectRoot, '.env');
  const promptsDir = path.join(projectRoot, 'prompts');

  // ============================================================
  // vault / 日记
  // ============================================================
  ipcMain.handle('vault:listDates', async () => {
    if (!fs.existsSync(vaultDir)) return [];
    return fs.readdirSync(vaultDir)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
  });

  ipcMain.handle('vault:readDay', async (_e, date: string) => {
    const dirPath = path.join(vaultDir, date);
    if (!fs.existsSync(dirPath)) {
      return { rawLogs: null, diaries: [], assets: [] };
    }
    const rawLogsPath = path.join(dirPath, '01_raw_logs.md');
    const rawLogs = fs.existsSync(rawLogsPath)
      ? fs.readFileSync(rawLogsPath, 'utf8')
      : null;
    const diaries = fs.readdirSync(dirPath)
      .filter(f => /^02_diary_v\d+\.md$/.test(f))
      .sort()
      .map(f => {
        const fp = path.join(dirPath, f);
        const stat = fs.statSync(fp);
        const versionMatch = f.match(/v(\d+)/);
        return {
          version: versionMatch ? parseInt(versionMatch[1], 10) : 0,
          file: f,
          content: fs.readFileSync(fp, 'utf8'),
          mtime: stat.mtimeMs,
        };
      });
    const assetsDir = path.join(dirPath, 'assets');
    const assets = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).sort()
      : [];
    return { rawLogs, diaries, assets };
  });

  ipcMain.handle('vault:readAssetDataUrl', async (_e, relPath: string) => {
    // relPath 形如 "2026-05-08/assets/xxx.jpg"，禁止穿越 vault 边界
    const absPath = path.resolve(vaultDir, relPath);
    if (!absPath.startsWith(vaultDir)) return null;
    if (!fs.existsSync(absPath)) return null;
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).slice(1).toLowerCase();
    const mime = (
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      ext === 'mp4' ? 'video/mp4' :
      'application/octet-stream'
    );
    return `data:${mime};base64,${buf.toString('base64')}`;
  });

  // ============================================================
  // 选题 / drafts
  // ============================================================
  ipcMain.handle('drafts:listNotes', async () => {
    const notesDir = path.join(vaultDir, 'Notes');
    if (!fs.existsSync(notesDir)) return [];
    const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
    const out = files.map(f => {
      const raw = fs.readFileSync(path.join(notesDir, f), 'utf8');
      const { meta } = parseFrontmatter(raw);
      return {
        filename: f,
        title: meta.title || f.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/\.md$/, ''),
        maturity: meta.maturity || '',
        category: meta.category || '',
        created: meta.created || (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
      };
    });
    // 按成熟度 + 日期排
    const score = (m: string) => m.includes('🌳') ? 3 : m.includes('🌿') ? 2 : m.includes('🌱') ? 1 : 0;
    out.sort((a, b) => {
      const s = score(b.maturity) - score(a.maturity);
      if (s !== 0) return s;
      return (b.created || '').localeCompare(a.created || '');
    });
    return out;
  });

  ipcMain.handle('drafts:listDrafts', async () => {
    const draftsDir = path.join(vaultDir, 'Drafts');
    if (!fs.existsSync(draftsDir)) return [];
    return fs.readdirSync(draftsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(f => {
        const raw = fs.readFileSync(path.join(draftsDir, f), 'utf8');
        const { meta, body } = parseFrontmatter(raw);
        return {
          filename: f,
          format: meta.format || '',
          sourceTitle: meta.source_title || '',
          sourceDate: meta.source_date || '',
          generatedAt: meta.generated_at || '',
          charCount: body.length,
        };
      });
  });

  ipcMain.handle('drafts:readNote', async (_e, filename: string) => {
    const fp = path.join(vaultDir, 'Notes', filename);
    if (!fp.startsWith(path.join(vaultDir, 'Notes'))) return null;
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf8');
  });

  ipcMain.handle('drafts:readDraft', async (_e, filename: string) => {
    const fp = path.join(vaultDir, 'Drafts', filename);
    if (!fp.startsWith(path.join(vaultDir, 'Drafts'))) return null;
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf8');
  });

  // ============================================================
  // 配置 / .env
  // ============================================================
  ipcMain.handle('config:readEnv', async () => {
    if (!fs.existsSync(envFile)) return {};
    return parseEnv(fs.readFileSync(envFile, 'utf8'));
  });

  ipcMain.handle('config:writeEnv', async (_e, values: Record<string, string>) => {
    try {
      // 备份
      if (fs.existsSync(envFile)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.copyFileSync(envFile, `${envFile}.backup-${stamp}`);
      }
      const content = serializeEnv(values, `# 由 echolog desktop 写入于 ${new Date().toISOString()}`);
      fs.writeFileSync(envFile, content);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('config:listPromptVersions', async (_e, name: string) => {
    if (!fs.existsSync(promptsDir)) return [];
    return fs.readdirSync(promptsDir)
      .filter(f => f.startsWith(`${name}_`) && f.endsWith('.md'))
      .map(f => f.replace(new RegExp(`^${name}_`), '').replace(/\.md$/, ''))
      .sort();
  });

  ipcMain.handle('config:readPrompt', async (_e, name: string, version: string) => {
    const fp = path.join(promptsDir, `${name}_${version}.md`);
    if (!fp.startsWith(promptsDir)) return null;
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf8');
  });

  // 列出所有注册的 prompt name + 元信息 + 各 name 的可用版本
  ipcMain.handle('config:listPromptRegistry', async () => {
    try {
      const promptsLib = require(path.join(projectRoot, 'lib', 'prompts.js'));
      const registry = promptsLib.listAllPromptNames();
      // 给每个 name 附上「可用版本列表」和「当前版本」
      return registry.map((item: any) => {
        const versions = fs.existsSync(promptsDir)
          ? fs.readdirSync(promptsDir)
              .filter(f => f.startsWith(`${item.name}_`) && f.endsWith('.md'))
              .map(f => f.replace(new RegExp(`^${item.name}_`), '').replace(/\.md$/, ''))
              .sort()
          : [];
        const envKey = promptsLib.ENV_KEY[item.name];
        const defaultVersion = promptsLib.DEFAULT_VERSION[item.name];
        return {
          name: item.name,
          label: item.label,
          description: item.description,
          envKey,
          defaultVersion,
          versions,
        };
      });
    } catch (err: any) {
      console.error('[config:listPromptRegistry]', err);
      return [];
    }
  });

  // ============================================================
  // 状态
  // ============================================================
  ipcMain.handle('status:getBotStatus', async () => {
    const pidFile = path.join(process.env.HOME || '', '.echolog', 'feishu.pid');
    if (!fs.existsSync(pidFile)) return { running: false };
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
    try {
      process.kill(pid, 0);
      // 拿内存
      let memMB: number | undefined;
      try {
        const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
        memMB = parseFloat(stdout.trim()) / 1024;
      } catch {}
      const logFile = path.join(
        process.env.HOME || '', '.echolog', 'logs',
        `feishu-${new Date().toISOString().slice(0, 10)}.log`
      );
      return { running: true, pid, memMB, logFile };
    } catch {
      return { running: false };
    }
  });

  ipcMain.handle('status:runDoctor', async () => {
    try {
      const { stdout, stderr } = await execAsync('node lib/doctor.js', {
        cwd: projectRoot,
        timeout: 60_000,
        env: { ...process.env, FORCE_COLOR: '0' },
        maxBuffer: 4 * 1024 * 1024,
      });
      return { stdout, stderr, code: 0 };
    } catch (err: any) {
      return { stdout: err.stdout || '', stderr: err.stderr || err.message, code: err.code || 1 };
    }
  });

  ipcMain.handle('status:getRatings', async () => {
    try {
      const ratingsPath = path.join(projectRoot, '.diary_ratings.jsonl');
      if (!fs.existsSync(ratingsPath)) {
        return { total: 0, avg: '0.0', byScore: {}, recent: [] };
      }
      const lines = fs.readFileSync(ratingsPath, 'utf8').split('\n').filter(Boolean);
      const rows = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
      const byScore: Record<string, number> = {};
      let sum = 0;
      for (const r of rows) {
        byScore[r.score] = (byScore[r.score] || 0) + 1;
        sum += r.score;
      }
      const avg = rows.length ? (sum / rows.length).toFixed(2) : '0.0';
      const recent = rows.slice(-10).reverse();
      return { total: rows.length, avg, byScore, recent };
    } catch (err: any) {
      return { total: 0, avg: '0.0', byScore: {}, recent: [], error: err.message };
    }
  });

  ipcMain.handle('status:getIndexStats', async () => {
    try {
      const metaPath = path.join(vaultDir, '_index', 'meta.json');
      const indexPath = path.join(vaultDir, '_index', 'embeddings.jsonl');
      if (!fs.existsSync(metaPath)) {
        return { model: '-', totalChunks: 0, days: 0, earliest: null, latest: null };
      }
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      let totalChunks = 0;
      const dates = new Set<string>();
      let earliest: string | null = null;
      let latest: string | null = null;
      if (fs.existsSync(indexPath)) {
        const lines = fs.readFileSync(indexPath, 'utf8').split('\n').filter(Boolean);
        totalChunks = lines.length;
        for (const l of lines) {
          try {
            const r = JSON.parse(l);
            if (r.date) {
              dates.add(r.date);
              if (!earliest || r.date < earliest) earliest = r.date;
              if (!latest || r.date > latest) latest = r.date;
            }
          } catch {}
        }
      }
      return { model: meta.model || '-', totalChunks, days: dates.size, earliest, latest };
    } catch (err: any) {
      return { model: '-', totalChunks: 0, days: 0, earliest: null, latest: null, error: err.message };
    }
  });

  // ============================================================
  // 跨日搜索（关键词 grep + 语义 recall）
  // ============================================================
  ipcMain.handle('search:keyword', async (_e, query: string, opts?: { includeDiaries?: boolean }) => {
    if (!query || query.length < 2) return [];
    if (!fs.existsSync(vaultDir)) return [];
    const includeDiaries = opts?.includeDiaries !== false;
    const dates = fs.readdirSync(vaultDir)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
    const results: Array<{
      date: string;
      type: 'raw' | 'diary';
      file: string;
      snippets: string[];
    }> = [];
    const q = query.toLowerCase();
    const MAX_RESULTS = 50;
    for (const d of dates) {
      if (results.length >= MAX_RESULTS) break;
      const dPath = path.join(vaultDir, d);
      const files: Array<{ file: string; type: 'raw' | 'diary' }> = [
        { file: '01_raw_logs.md', type: 'raw' },
      ];
      if (includeDiaries) {
        for (const f of fs.readdirSync(dPath)) {
          if (/^02_diary_v\d+\.md$/.test(f)) files.push({ file: f, type: 'diary' });
        }
      }
      for (const { file, type } of files) {
        const fp = path.join(dPath, file);
        if (!fs.existsSync(fp)) continue;
        const content = fs.readFileSync(fp, 'utf8');
        const lower = content.toLowerCase();
        if (!lower.includes(q)) continue;
        // 抽取 ±100 char 上下文，最多 3 个
        const snippets: string[] = [];
        let idx = 0;
        while ((idx = lower.indexOf(q, idx)) !== -1 && snippets.length < 3) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(content.length, idx + query.length + 80);
          let snippet = content.slice(start, end).replace(/\n/g, ' ');
          if (start > 0) snippet = '…' + snippet;
          if (end < content.length) snippet = snippet + '…';
          snippets.push(snippet);
          idx += query.length;
        }
        results.push({ date: d, type, file, snippets });
        if (results.length >= MAX_RESULTS) break;
      }
    }
    return results;
  });

  ipcMain.handle('search:semantic', async (_e, query: string, opts?: { topK?: number; minScore?: number }) => {
    if (!query || query.length < 2) return { ok: false, error: '关键词太短', hits: [] };
    try {
      const embeddings = require(path.join(projectRoot, 'lib', 'embeddings.js'));
      const hits = await embeddings.query(query, {
        topK: opts?.topK || 10,
        minScore: opts?.minScore || 0.35,
      });
      return { ok: true, hits };
    } catch (err: any) {
      return { ok: false, error: err.message, hits: [] };
    }
  });

  // ============================================================
  // Prompt 编辑（含新建版本）
  // ============================================================
  ipcMain.handle('config:writePrompt', async (_e, name: string, version: string, content: string) => {
    try {
      if (!/^[a-z0-9_]+$/.test(name) || !/^[a-z0-9_]+$/.test(version)) {
        return { ok: false, error: 'name/version 只能含小写字母数字下划线' };
      }
      const fp = path.join(promptsDir, `${name}_${version}.md`);
      if (!fp.startsWith(promptsDir)) return { ok: false, error: '非法路径' };
      // 备份旧版
      if (fs.existsSync(fp)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.copyFileSync(fp, `${fp}.backup-${stamp}`);
      }
      // 必须含 ## SYSTEM + ## TEMPLATE，否则 prompts.js loadPromptPair 会报错
      if (!content.includes('## SYSTEM') || !content.includes('## TEMPLATE')) {
        return { ok: false, error: 'prompt 必须含 "## SYSTEM" 和 "## TEMPLATE" 段' };
      }
      if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(fp, content);
      return { ok: true, file: path.relative(projectRoot, fp) };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // Bot 进程控制（start / stop / restart）
  // ============================================================
  async function runDailyBot(subcmd: string, timeoutMs = 15_000): Promise<{ ok: boolean; output: string; error?: string }> {
    try {
      // 优先用 npm-link 的 echolog；找不到就退回 ./bin/echolog
      const cliCandidates = ['echolog', path.join(projectRoot, 'bin', 'echolog')];
      let lastErr: any = null;
      for (const cli of cliCandidates) {
        try {
          const { stdout, stderr } = await execAsync(`${cli} ${subcmd}`, {
            cwd: projectRoot,
            timeout: timeoutMs,
            env: { ...process.env, FORCE_COLOR: '0' },
            maxBuffer: 1024 * 1024,
          });
          return { ok: true, output: (stdout || '') + (stderr ? `\n${stderr}` : '') };
        } catch (err: any) {
          lastErr = err;
          if (err.code === 'ENOENT' || /not found/i.test(err.message)) continue;
          return { ok: false, output: (err.stdout || '') + (err.stderr || ''), error: err.message };
        }
      }
      return { ok: false, output: '', error: lastErr?.message || 'echolog 命令未找到' };
    } catch (err: any) {
      return { ok: false, output: '', error: err.message };
    }
  }
  ipcMain.handle('bot:start', () => runDailyBot('start', 15_000));
  ipcMain.handle('bot:stop', () => runDailyBot('stop', 10_000));
  ipcMain.handle('bot:restart', () => runDailyBot('restart', 20_000));

  // 直接触发 bot 端命令（diary / week）—— 通过本地 HTTP /command 端点
  ipcMain.handle('bot:triggerCommand', async (_e, command: string, date?: string) => {
    const port = parseInt(process.env.INGEST_PORT || '8766', 10);
    try {
      const { fetch } = await import('undici');
      const resp = await fetch(`http://127.0.0.1:${port}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, date }),
      });
      const text = await resp.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { error: text }; }
      if (!resp.ok) return { ok: false, error: body.error || `HTTP ${resp.status}` };
      return { ok: true, ...body };
    } catch (err: any) {
      return { ok: false, error: `${err.message}（bot 没起？检查 echolog status）` };
    }
  });

  // 实时读最近 N 行 log
  ipcMain.handle('bot:tailLog', async (_e, lines: number = 80) => {
    const logFile = path.join(
      process.env.HOME || '', '.echolog', 'logs',
      `feishu-${new Date().toISOString().slice(0, 10)}.log`,
    );
    if (!fs.existsSync(logFile)) return '';
    try {
      const { stdout } = await execAsync(`tail -n ${Math.max(1, Math.min(2000, lines))} "${logFile}"`, {
        maxBuffer: 4 * 1024 * 1024,
      });
      return stdout;
    } catch (err: any) {
      return `[读 log 失败] ${err.message}`;
    }
  });

  // ============================================================
  // LLM 连通性测试（按当前 .env 配置调一次小请求）
  // ============================================================
  ipcMain.handle('llm:ping', async () => {
    // 用子进程跑，避免污染主进程 dotenv 状态
    try {
      const script = `
        require('dotenv').config({ path: '${path.join(projectRoot, '.env').replace(/'/g, "\\'")}' });
        const llm = require('${path.join(projectRoot, 'lib', 'llm.js').replace(/'/g, "\\'")}');
        const model = process.env.LLM_TEXT_MODEL || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
        (async () => {
          const t0 = Date.now();
          try {
            const r = await llm.chat({
              model,
              messages: [{ role: 'user', content: '只回复"pong"两个字' }],
              think: false, stream: false,
              options: { temperature: 0, num_predict: 8 },
            });
            const dur = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(JSON.stringify({
              ok: true,
              provider: llm.describe().provider,
              model,
              reply: r.message.content.slice(0, 100),
              durationSec: dur,
            }));
          } catch (err) {
            console.log(JSON.stringify({
              ok: false,
              provider: llm.describe().provider,
              model,
              error: err.friendlyMessage || err.message,
              durationSec: ((Date.now() - t0) / 1000).toFixed(1),
            }));
          }
        })();
      `;
      const { stdout } = await execAsync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        cwd: projectRoot,
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      });
      const lastLine = stdout.trim().split('\n').filter(Boolean).pop() || '{}';
      try {
        return JSON.parse(lastLine);
      } catch {
        return { ok: false, error: `非 JSON 输出: ${stdout.slice(-200)}` };
      }
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // 元信息 / 系统操作
  // ============================================================
  ipcMain.handle('meta:getProjectRoot', async () => projectRoot);
  ipcMain.handle('meta:openInFinder', async (_e, relPath: string) => {
    const absPath = path.resolve(projectRoot, relPath);
    if (!absPath.startsWith(projectRoot)) return;
    shell.showItemInFolder(absPath);
  });
  ipcMain.handle('meta:openExternal', async (_e, url: string) => {
    if (!/^https?:\/\//.test(url)) return;
    shell.openExternal(url);
  });
}

// re-export 让外部能从 ipc 也能访问（已迁移到 env-utils.ts，这里保留兼容）
export { parseFrontmatter, parseEnv, serializeEnv };
