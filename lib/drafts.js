// 选题 → 写作流水线
//
// /draft list                 列出 Notes/ 下所有选题（按成熟度倒序）
// /draft <id|标题片段>         默认推特串
// /draft <id> --long          公众号长文
// /draft <id> --video         短视频脚本（90s）
// /draft <id> --all           一选三发：推特 + 长文 + 短视频 并发跑
//
// 输出：Daily_Vault/Drafts/<date>_<format>_<slug>.md 带 frontmatter

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const ollama = require('./llm');
const embeddings = require('./embeddings');

const { VAULT_DIR } = require('./paths');
const NOTES_DIR = path.join(VAULT_DIR, 'Notes');
const DRAFTS_DIR = path.join(VAULT_DIR, 'Drafts');
const TEXT_MODEL = process.env.LLM_TEXT_MODEL || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';

// 成熟度排序：🌳 > 🌿 > 🌱
const MATURITY_ORDER = { '🌳': 3, '🌿': 2, '🌱': 1 };
function maturityScore(m) {
  if (!m) return 0;
  for (const [emoji, score] of Object.entries(MATURITY_ORDER)) {
    if (m.includes(emoji)) return score;
  }
  return 0;
}

// 从 markdown frontmatter 抽 yaml-like 字段（不引入 yaml 依赖，自己拆）
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { meta: {}, body: content };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[kv[1]] = val;
  }
  return { meta, body: content.slice(m[0].length).replace(/^\n+/, '') };
}

function listNotes() {
  if (!fs.existsSync(NOTES_DIR)) return [];
  const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md'));
  const notes = [];
  for (const f of files) {
    const fullPath = path.join(NOTES_DIR, f);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    notes.push({
      file: fullPath,
      filename: f,
      title: meta.title || f.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/\.md$/, ''),
      maturity: meta.maturity || '',
      category: meta.category || '',
      created: meta.created || (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
      ticktick_id: meta.ticktick_id || '',
      body,
    });
  }
  notes.sort((a, b) => {
    const ms = maturityScore(b.maturity) - maturityScore(a.maturity);
    if (ms !== 0) return ms;
    return (b.created || '').localeCompare(a.created || '');
  });
  return notes;
}

function findNote(idOrFragment, notes) {
  // 数字 id（基于 listNotes 的顺序，1-based）
  const n = parseInt(idOrFragment, 10);
  if (Number.isFinite(n) && n >= 1 && n <= notes.length && String(n) === idOrFragment.trim()) {
    return notes[n - 1];
  }
  // 标题片段 fuzzy match（lower-case 包含）
  const q = idOrFragment.toLowerCase().trim();
  return notes.find(nt => nt.title.toLowerCase().includes(q))
      || notes.find(nt => nt.filename.toLowerCase().includes(q));
}

// 读 created 当天的 raw_logs（裁前 3000 char，避免上下文爆）
function readSourceLogs(dateStr) {
  if (!dateStr) return '';
  const logFile = path.join(VAULT_DIR, dateStr, '01_raw_logs.md');
  if (!fs.existsSync(logFile)) return '';
  const raw = fs.readFileSync(logFile, 'utf8').replace(/^---[\s\S]*?---\n+/, '');
  return raw.length > 3000 ? raw.slice(0, 3000) + '\n…[已裁断]' : raw;
}

// ==========================================================================
// Prompts —— 现在都走 prompts/drafts_<format>_<version>.md 加载（GUI 可编辑）
// ==========================================================================
const prompts = require('./prompts');

// format → prompt name 映射
const FORMAT_TO_PROMPT_NAME = {
  twitter: 'drafts_twitter',
  long: 'drafts_long',
  video: 'drafts_video',
};

function loadDraftPrompt(format) {
  const name = FORMAT_TO_PROMPT_NAME[format];
  if (!name) throw new Error(`unknown draft format: ${format}`);
  return prompts.loadPromptPair(name);
}

const FORMAT_LABELS = {
  twitter: '推特串',
  long: '公众号长文',
  video: '短视频脚本',
};

// ==========================================================================
// 草稿生成
// ==========================================================================

async function generateOne(note, format, options = {}) {
  const promptPair = loadDraftPrompt(format);
  const sysPrompt = promptPair.system;

  // 拉灵感来源当天的 logs
  const sourceLogs = readSourceLogs(note.created);

  // 跨日找语义相似 logs（嫁接历史素材）
  let relatedHits = [];
  if (options.useEmbedding !== false) {
    try {
      relatedHits = await embeddings.query(note.title, {
        topK: 5,
        minScore: 0.4,
        excludeDate: note.created,
      });
    } catch (err) {
      // embedding 不可用就跳过，不阻塞主流程
      console.error(`[draft embed] ${err.message}`);
    }
  }

  const relatedBlock = relatedHits.length
    ? relatedHits.map(h => `- 📅 ${h.date} ${h.time} (相似 ${(h.score * 100).toFixed(0)}%)\n  ${h.text.slice(0, 240).replace(/\n/g, ' / ')}`).join('\n\n')
    : '（无相关历史素材）';

  // user 段 = prompt 文件的 TEMPLATE 段 + 注入的 3 块数据（选题 / source logs / 相关素材）
  const userPrompt = `${promptPair.template}

==========
【选题信息】
${note.body.trim()}

【灵感来源当天 logs（${note.created || '未知日期'}，参考用）】
${sourceLogs || '（找不到 source logs）'}

【其他天的相关素材（向量检索结果，可选用）】
${relatedBlock}

==========
请按系统 prompt 的格式严格输出 ${FORMAT_LABELS[format]}。直接出成稿，不要解释。`;

  const r = await ollama.chat({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt },
    ],
    think: false,
    stream: false,
    options: {
      temperature: 0.5,
      num_ctx: 16384,
    },
  });
  return r.message.content;
}

function slugifyTitle(title) {
  return title
    .replace(/^[标题：:]\s*/, '')
    .replace(/\[\[(.+?)\]\]/g, '$1')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .slice(0, 60)
    .trim();
}

function saveDraft(note, format, content) {
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const today = dayjs().format('YYYY-MM-DD');
  const slug = slugifyTitle(note.title);
  const filename = `${today}_${format}_${slug}.md`;
  const filePath = path.join(DRAFTS_DIR, filename);
  const generatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const fm = [
    '---',
    `type: draft`,
    `format: ${format}`,
    `source_note: ${path.relative(VAULT_DIR, note.file)}`,
    `source_title: "${note.title.replace(/"/g, '\\"')}"`,
    `source_maturity: "${note.maturity}"`,
    `source_category: "${note.category}"`,
    `source_date: ${note.created}`,
    `generated_at: "${generatedAt}"`,
    `model: ${TEXT_MODEL}`,
    `tags: [draft, ${format}, ${today.slice(0, 7)}]`,
    '---',
    '',
    `# [${FORMAT_LABELS[format]}] ${note.title}`,
    '',
    content,
    '',
  ].join('\n');
  fs.writeFileSync(filePath, fm);
  return filePath;
}

// 一选三发：并发跑三个 format
async function generateAll(note, options = {}) {
  const formats = ['twitter', 'long', 'video'];
  const results = await Promise.all(formats.map(async fmt => {
    try {
      const content = await generateOne(note, fmt, options);
      const file = saveDraft(note, fmt, content);
      return { format: fmt, ok: true, file, charCount: content.length };
    } catch (err) {
      return { format: fmt, ok: false, error: err.message };
    }
  }));
  return results;
}

module.exports = {
  listNotes,
  findNote,
  generateOne,
  generateAll,
  saveDraft,
  FORMAT_LABELS,
  FORMAT_TO_PROMPT_NAME,
};
