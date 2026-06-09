// TickTick / 滴答清单 集成：OAuth 2.0 授权 + 任务读写 + 行动项去重同步
//
// State 文件 .ticktick-state.json (gitignored) 持有：
//   tokens.access_token / .expires_at —— 授权状态
//   synced[YYYY-MM-DD][] —— 已经同步到滴答的行动项 hash + task_id，避免 /diary 多次跑
//                          时重复创建同一条任务
//
// 用法：
//   const tt = require('./lib/ticktick');
//   if (tt.isAuthed()) {
//     const ctx = await tt.getTodayContext('2026-05-01');  // overdue + dueToday + completedToday
//     const md = tt.formatContextForPrompt(ctx, '2026-05-01');
//     // …generateDiary(md)…
//     const result = await tt.syncActionItems('2026-05-01', diaryText); // 自动去重
//   }
//
//   一次性授权：require('./lib/ticktick').runAuthFlow();
//   通过 echolog ticktick-auth 调用。

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const fetch = require('node-fetch');

const STATE_FILE = path.join(__dirname, '..', '.ticktick-state.json');

// 飞书风格的滴答清单（中国版）OpenAPI 端点
const AUTH_URL = 'https://dida365.com/oauth/authorize';
const TOKEN_URL = 'https://dida365.com/oauth/token';
const API_BASE = 'https://api.dida365.com/open/v1';
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:8765/callback';
const SCOPES = 'tasks:read tasks:write';

// ===========================================================================
// 状态读写
// ===========================================================================
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { tokens: null, synced: {} };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    console.error(`[ticktick] state 文件损坏，重建: ${err.message}`);
    return { tokens: null, synced: {} };
  }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isAuthed() {
  const s = loadState();
  if (!s.tokens?.access_token) return false;
  if (s.tokens.expires_at && Date.now() >= s.tokens.expires_at) return false;
  return true;
}

function getAccessToken() {
  const s = loadState();
  if (!s.tokens?.access_token) {
    throw new Error('TickTick 未授权，请运行 echolog ticktick-auth');
  }
  if (s.tokens.expires_at && Date.now() >= s.tokens.expires_at) {
    throw new Error('TickTick token 已过期，请重新运行 echolog ticktick-auth');
  }
  return s.tokens.access_token;
}

// ===========================================================================
// API 调用包装
// ===========================================================================
async function api(apiPath, options = {}) {
  const token = getAccessToken();
  const r = await fetch(`${API_BASE}${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`TickTick API ${r.status} ${apiPath}: ${body.slice(0, 200)}`);
  }
  // 有些写接口返回空 body
  const text = await r.text();
  return text ? JSON.parse(text) : {};
}

async function listProjects() {
  return api('/project');
}

async function listTasksInProject(projectId) {
  const data = await api(`/project/${projectId}/data`);
  return data.tasks || [];
}

async function listAllTasks() {
  let projects = [];
  try {
    projects = await listProjects();
  } catch (err) {
    console.error(`[ticktick] listProjects 失败: ${err.message}`);
    return [];
  }
  const all = [];
  for (const p of projects) {
    try {
      const tasks = await listTasksInProject(p.id);
      tasks.forEach(t => { t._projectName = p.name; });
      all.push(...tasks);
    } catch (err) {
      console.error(`[ticktick] project "${p.name}" 拉取失败: ${err.message}`);
    }
  }
  return all;
}

// ===========================================================================
// 今日上下文
// ===========================================================================
function dateOf(iso) {
  if (!iso) return null;
  // ISO 8601 with tz; we only care about YYYY-MM-DD in Asia/Shanghai
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // shift to +0800 then format
  const shanghai = new Date(d.getTime() + 8 * 3600 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

async function getTodayContext(todayStr) {
  const tasks = await listAllTasks();
  const overdue = [];
  const dueToday = [];
  const completedToday = [];
  for (const t of tasks) {
    const due = dateOf(t.dueDate);
    const completed = dateOf(t.completedTime);
    if (t.status === 2) {
      if (completed === todayStr) completedToday.push(t);
      continue;
    }
    if (!due) continue;
    if (due === todayStr) dueToday.push(t);
    else if (due < todayStr) overdue.push(t);
  }
  return { overdue, dueToday, completedToday, totalProjects: 0 };
}

function daysBetween(aStr, bStr) {
  const a = new Date(`${aStr}T00:00:00+0800`).getTime();
  const b = new Date(`${bStr}T00:00:00+0800`).getTime();
  return Math.round((a - b) / 86400000);
}

function formatContextForPrompt(ctx, todayStr) {
  const lines = [];
  if (ctx.dueToday.length) {
    lines.push(`**今天 due 但未完成 (${ctx.dueToday.length})：**`);
    for (const t of ctx.dueToday) {
      lines.push(`- ${t.title}${t.priority >= 3 ? ' ⚠️高优' : ''}${t._projectName ? `  [${t._projectName}]` : ''}`);
    }
  }
  if (ctx.overdue.length) {
    if (lines.length) lines.push('');
    lines.push(`**已逾期未完成 (${ctx.overdue.length})：**`);
    for (const t of ctx.overdue) {
      const due = dateOf(t.dueDate);
      const days = daysBetween(todayStr, due);
      lines.push(`- ${t.title}（逾期 ${days} 天，原 due ${due}）${t._projectName ? `  [${t._projectName}]` : ''}`);
    }
  }
  if (ctx.completedToday.length) {
    if (lines.length) lines.push('');
    lines.push(`**今天已完成 (${ctx.completedToday.length})：**`);
    for (const t of ctx.completedToday) lines.push(`- ✅ ${t.title}${t._projectName ? `  [${t._projectName}]` : ''}`);
  }
  return lines.length ? lines.join('\n') : '（今天滴答清单上没有相关任务）';
}

// ===========================================================================
// 创建任务
// ===========================================================================
async function createTask({ title, content, dueDate, priority, projectId } = {}) {
  if (!title) throw new Error('createTask 需要 title');
  const body = { title };
  if (content) body.content = content;
  if (dueDate) body.dueDate = dueDate;
  if (priority != null) body.priority = priority;
  if (projectId) body.projectId = projectId;
  return api('/task', { method: 'POST', body: JSON.stringify(body) });
}

// ===========================================================================
// 行动项提取 + 去重同步
// ===========================================================================
function normalizeTitle(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hashAction(text) {
  return crypto.createHash('sha256').update(normalizeTitle(text)).digest('hex').slice(0, 16);
}

// 从 markdown 文本里提取行动项。
// 返回 { tasks: ['xxx'], notes: [{title, body}] }
//   tasks  —— 真正要做的任务，格式：- [ ] 具体动作
//   notes  —— 自媒体选题，格式：- [📝] 标题 \n   - 后续行作为 body
function extractActionItems(text) {
  const lines = text.split('\n');
  const tasks = [];
  const notes = [];
  let currentNote = null;

  const flushNote = () => {
    if (currentNote) {
      notes.push({
        title: currentNote.title,
        body: currentNote.body.join('\n').trim(),
      });
      currentNote = null;
    }
  };

  for (const line of lines) {
    const taskMatch = /^\s*[-*]\s*\[\s\]\s*(.+?)\s*$/.exec(line);
    const noteMatch = /^\s*[-*]\s*\[\s*📝\s*\]\s*(.+?)\s*$/.exec(line);

    if (noteMatch) {
      flushNote();
      currentNote = { title: noteMatch[1].trim(), body: [] };
      continue;
    }
    if (taskMatch) {
      flushNote();
      if (taskMatch[1].trim()) tasks.push(taskMatch[1].trim());
      continue;
    }
    // 选题的"详情"延续行（缩进 + 内容）
    if (currentNote && /^\s+\S/.test(line)) {
      currentNote.body.push(line.trim());
      continue;
    }
    // 空行不打断 currentNote，但其他正文打断
    if (line.trim() === '') continue;
    flushNote();
  }
  flushNote();
  return { tasks, notes };
}

// 找特定 kind 的项目（'NOTE' / 'TASK'）和名字
async function findProjectByName(name, kind = null) {
  const projects = await listProjects();
  const target = projects.find(p => {
    if (p.name !== name) return false;
    if (kind && p.kind !== kind) return false;
    return true;
  });
  return target || null;
}

// 把选题同时落地到本地 vault Notes/ 文件夹，方便在 Obsidian 里管理
function mirrorNoteToVault(vaultDir, dateStr, note, taskId) {
  if (!vaultDir) return null;
  const notesDir = path.join(vaultDir, 'Notes');
  if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });

  // 文件名：日期 + 净化后的标题
  const safeTitle = note.title
    .replace(/^标题：/, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const filePath = path.join(notesDir, `${dateStr}_${safeTitle}.md`);

  // 从 body 里抽 7 字段（best effort）
  const fields = {};
  for (const line of note.body.split('\n')) {
    const m = /^[-*]\s*(主题|成熟度|钩子|角度|结构|形式|灵感来源)\s*[：:]\s*(.+)$/.exec(line.trim());
    if (m) fields[m[1]] = m[2].trim();
  }

  const tags = ['content-idea'];
  if (fields['成熟度']) {
    const m = fields['成熟度'].match(/[🌱🌿🌳]/);
    if (m) {
      const map = { '🌱': '萌芽', '🌿': '雏形', '🌳': '成熟' };
      tags.push(`status/${map[m[0]] || '未定'}`);
    }
  }
  if (fields['主题']) tags.push(`category/${fields['主题'].replace(/\s+/g, '')}`);

  const fm = [
    '---',
    `type: content-idea`,
    `created: ${dateStr}`,
    `title: ${JSON.stringify(safeTitle)}`,
    fields['主题'] ? `category: ${fields['主题']}` : null,
    fields['成熟度'] ? `maturity: ${JSON.stringify(fields['成熟度'])}` : null,
    fields['形式'] ? `format: ${JSON.stringify(fields['形式'])}` : null,
    taskId ? `ticktick_id: ${taskId}` : null,
    `status: pending`,
    `tags: [${tags.map(t => JSON.stringify(t)).join(', ')}]`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const body = [
    `# ${safeTitle}`,
    '',
    note.body,
    '',
    '---',
    '## ✍️ 写作进度',
    '- [ ] 角度细化',
    '- [ ] 数据/截图收集',
    '- [ ] 初稿',
    '- [ ] 试讲（自己念一遍录下来听）',
    '- [ ] 成稿 / 录制',
    '- [ ] 发布',
    '',
    '## 📝 草稿区',
    '（在这里展开正文。可在 Obsidian 里用本地 LLM 插件一键生成草稿）',
    '',
    '## 🔗 相关',
    `- [[${dateStr}/02_diary_v1]] —— 灵感源 diary（version 实际可能是 v2/v3...）`,
    '',
  ].join('\n');

  fs.writeFileSync(filePath, fm + body);
  return filePath;
}

// 同步策略：
//   - 默认：任务 + 选题 都进 Notes 项目（kind: NOTE）—— 不污染 Today 视图、无 dueDate
//   - 用户可设 TICKTICK_TASKS_PROJECT_ID 把任务路由到指定项目
//   - 跨天去重：hash 全局唯一，不再 per-day（避免每天 /diary 都重新建相同任务）
async function syncActionItems(dateStr, diaryText, opts = {}) {
  const { tasks, notes } = extractActionItems(diaryText);
  if (!tasks.length && !notes.length) {
    return { tasks: { created: [], skipped: [], failed: [] }, notes: { created: [], skipped: [], failed: [] } };
  }
  const vaultDir = opts.vaultDir || null;

  const state = loadState();
  if (!state.synced) state.synced = {};
  if (!state.synced[dateStr]) state.synced[dateStr] = [];

  // 找 Notes 项目 ID（kind: NOTE）——— 任务和选题统一路由到这里
  let notesProjectId = state.notes_project_id;
  if (!notesProjectId) {
    try {
      const p = await findProjectByName('Notes', 'NOTE');
      if (p) {
        notesProjectId = p.id;
        state.notes_project_id = p.id;
        saveState(state);
      }
    } catch (err) {
      console.error(`[ticktick] 找 Notes 项目失败: ${err.message}`);
    }
  }

  // 任务的目标项目：env 优先（用户可路由到任何指定项目，留'inbox'走默认 Inbox）
  // 默认（未配置）= 跟选题一起进 Notes（kind: NOTE，不污染 Today 视图）
  const taskProjectEnv = process.env.TICKTICK_TASKS_PROJECT_ID || '';
  const tasksProjectId = taskProjectEnv === 'inbox'
    ? null  // null 走默认 Inbox
    : (taskProjectEnv || notesProjectId);

  // 跨天 dedup：扫所有历史已同步过的，hash 全局唯一
  // 防止每天 /diary 都把"修复飞书机器人被杀"这种相同任务重复创建
  const allSynced = [];
  for (const arr of Object.values(state.synced)) {
    if (Array.isArray(arr)) allSynced.push(...arr);
  }

  const result = {
    tasks: { created: [], skipped: [], failed: [] },
    notes: { created: [], skipped: [], failed: [] },
  };

  // 1) 真任务（默认进 Notes，无 dueDate，跨天去重）
  for (const item of tasks) {
    const h = hashAction(item);
    const key = `task:${h}`;
    const dup = allSynced.find(s => s.hash === key);
    if (dup) {
      result.tasks.skipped.push({ title: item, hash: key, taskId: dup.task_id, fromDate: dup.date_str });
      continue;
    }
    try {
      const taskBody = { title: item, content: `from /diary ${dateStr}` };
      // 注意：不再设置 dueDate；不再每天积压到 Today 视图
      if (tasksProjectId) taskBody.projectId = tasksProjectId;
      const task = await createTask(taskBody);
      const entry = {
        hash: key,
        task_id: task.id,
        title: item,
        kind: 'task',
        date_str: dateStr,
        created_at: new Date().toISOString(),
      };
      state.synced[dateStr].push(entry);
      allSynced.push(entry);
      saveState(state);
      result.tasks.created.push({ title: item, taskId: task.id });
    } catch (err) {
      console.error(`[ticktick] 创建任务失败 "${item}": ${err.message}`);
      result.tasks.failed.push({ title: item, error: err.message });
    }
  }

  // 2) 选题 → Notes 项目（无 dueDate，跨天去重，剥离"标题："前缀让 TickTick 列表更清爽）
  for (const note of notes) {
    const cleanTitle = note.title.replace(/^标题：\s*/, '').trim();
    const h = hashAction(cleanTitle);
    const key = `note:${h}`;
    const dup = allSynced.find(s => s.hash === key);
    if (dup) {
      result.notes.skipped.push({ title: cleanTitle, hash: key, taskId: dup.task_id, fromDate: dup.date_str });
      continue;
    }
    if (!notesProjectId) {
      result.notes.failed.push({ title: cleanTitle, error: '找不到 Notes 项目（请在滴答清单创建一个名为 Notes 的笔记列表）' });
      continue;
    }
    try {
      const task = await createTask({
        title: cleanTitle,
        content: `${note.body}\n\n---\nfrom /diary ${dateStr}`,
        projectId: notesProjectId,
        // 注意：不设 dueDate
      });
      const entry = {
        hash: key,
        task_id: task.id,
        title: cleanTitle,
        kind: 'note',
        date_str: dateStr,
        created_at: new Date().toISOString(),
      };
      state.synced[dateStr].push(entry);
      allSynced.push(entry);
      saveState(state);
      // 同时镜像到本地 vault Notes/
      let localPath = null;
      try {
        localPath = mirrorNoteToVault(vaultDir, dateStr, { ...note, title: cleanTitle }, task.id);
      } catch (mirrorErr) {
        console.error(`[ticktick] 本地镜像选题失败: ${mirrorErr.message}`);
      }
      result.notes.created.push({ title: cleanTitle, taskId: task.id, localPath });
    } catch (err) {
      console.error(`[ticktick] 创建选题失败 "${cleanTitle}": ${err.message}`);
      result.notes.failed.push({ title: cleanTitle, error: err.message });
    }
  }

  return result;
}

// ===========================================================================
// OAuth 授权流（一次性）
// ===========================================================================
async function runAuthFlow({ clientId, clientSecret, redirectUri = DEFAULT_REDIRECT_URI } = {}) {
  clientId = clientId || process.env.TICKTICK_CLIENT_ID;
  clientSecret = clientSecret || process.env.TICKTICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('缺少 TICKTICK_CLIENT_ID / TICKTICK_CLIENT_SECRET，请先填到 .env');
  }
  const stateNonce = crypto.randomBytes(8).toString('hex');
  const port = parseInt(new URL(redirectUri).port, 10) || 8765;
  const callbackPath = new URL(redirectUri).pathname;

  const authUrl = `${AUTH_URL}?` + new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    state: stateNonce,
    redirect_uri: redirectUri,
    response_type: 'code',
  }).toString();

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, redirectUri);
        if (reqUrl.pathname !== callbackPath) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const code = reqUrl.searchParams.get('code');
        const returnedState = reqUrl.searchParams.get('state');
        if (!code) {
          res.statusCode = 400;
          res.end('Missing code parameter');
          server.close();
          return reject(new Error('授权未返回 code'));
        }
        if (returnedState !== stateNonce) {
          res.statusCode = 400;
          res.end('State mismatch');
          server.close();
          return reject(new Error('OAuth state 不匹配，可能被劫持，已中止'));
        }

        // 换 token
        const formBody = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          scope: SCOPES,
          redirect_uri: redirectUri,
        }).toString();
        const tokenResp = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody,
        });
        const tokenText = await tokenResp.text();
        if (!tokenResp.ok) {
          res.statusCode = 500;
          res.end(`Token exchange failed: ${tokenResp.status} ${tokenText}`);
          server.close();
          return reject(new Error(`token exchange ${tokenResp.status}: ${tokenText.slice(0, 200)}`));
        }
        const tokenData = JSON.parse(tokenText);
        const expiresIn = tokenData.expires_in || 15552000; // 默认 180 天
        const tokens = {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'Bearer',
          scope: tokenData.scope || SCOPES,
          expires_at: Date.now() + (expiresIn - 60) * 1000,
          obtained_at: new Date().toISOString(),
        };
        const s = loadState();
        s.tokens = tokens;
        saveState(s);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html><head><meta charset="utf-8"><title>授权成功</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 20px">
<h1>✅ 滴答清单已授权</h1>
<p>令牌有效期约 <b>${Math.floor(expiresIn / 86400)}</b> 天。</p>
<p>可以关闭这个窗口，回到终端继续。</p>
</body></html>`);
        server.close();
        resolve(tokens);
      } catch (err) {
        try {
          res.statusCode = 500;
          res.end(`Error: ${err.message}`);
        } catch {}
        server.close();
        reject(err);
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      console.log(`\n✅ 本地回调服务器已启动 http://127.0.0.1:${port}`);
      console.log('\n👉 在浏览器打开下面的链接进行授权：\n');
      console.log(`   ${authUrl}\n`);
      console.log('（授权完成后此进程会自动退出）\n');
    });
  });
}

module.exports = {
  // state
  isAuthed,
  loadState,
  saveState,
  // api
  listProjects,
  listAllTasks,
  findProjectByName,
  // diary helpers
  getTodayContext,
  formatContextForPrompt,
  createTask,
  extractActionItems,
  hashAction,
  syncActionItems,
  // auth
  runAuthFlow,
};
