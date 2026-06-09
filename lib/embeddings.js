// 跨日记忆 / 语义索引 —— 基于 Ollama embedding + 本地 jsonl
//
// 设计：
//   - Daily_Vault/_index/embeddings.jsonl 一行一个 chunk
//   - chunk 粒度 = raw_logs 里一个 **HH:MM:SS** 时间块
//   - 重新索引同一天会替换该日所有 chunks
//   - cosine 相似度纯 JS，量小（<10000 chunks）够用
//
// 依赖：Ollama 本地服务 + 一个 embedding 模型（默认 bge-large，中文友好 670MB）
//   ollama pull bge-large
//   想要更高质量：OLLAMA_EMBED_MODEL=qwen3-embedding:4b（2.5GB，中文最好但慢）

require('dotenv').config({ path: require('./paths').ENV_FILE });
const fs = require('fs');
const path = require('path');
const ollamaClient = require('./llm');

const { VAULT_DIR } = require('./paths');
const INDEX_DIR = path.join(VAULT_DIR, '_index');
const INDEX_FILE = path.join(INDEX_DIR, 'embeddings.jsonl');
const META_FILE = path.join(INDEX_DIR, 'meta.json');
const EMBED_MODEL = process.env.LLM_EMBED_MODEL || process.env.OLLAMA_EMBED_MODEL || 'bge-large:335m';

function ensureDir() {
  if (!fs.existsSync(INDEX_DIR)) fs.mkdirSync(INDEX_DIR, { recursive: true });
}

async function embedText(text) {
  const r = await ollamaClient.embed({ model: EMBED_MODEL, input: text });
  const vec = r.embeddings && r.embeddings[0];
  if (!vec || !vec.length) {
    throw new Error(`Ollama embedding 返回空（model=${EMBED_MODEL}）`);
  }
  return vec;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 移除 markdown 媒体链接（图片/语音/视频）和裸路径，留下「实质语义内容」用于判定
// 这是为了过滤"只发了一张图但无配文"这种 chunk，避免污染向量检索
function semanticContent(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')              // ![alt](path)
    .replace(/\[[^\]]+\]\(assets\/[^)]+\)/g, '')        // [文件名](assets/...)
    .replace(/[🎙🎬📎🖼]\s*/g, '')                       // 媒体 emoji 前缀
    .replace(/^\s*>\s*💡?\s*\*\*\[视觉辅助提取信息\]\*\*：/gm, '') // 视觉模型注释开头
    .replace(/\s+/g, ' ')
    .trim();
}

// 切分 raw_logs：每个 **HH:MM:SS** 起一个 chunk，到下一个前都是 body。
// 跳过 frontmatter（--- ... ---）。
// 单 chunk 超过 MAX_CHARS 自动按段落（\n\n）二次切分，避免超出 embedding ctx。
function splitLogsToChunks(rawLogs) {
  const MAX_CHARS = 500; // bge-large 512 token；中文 BPE 下 1 char ≈ 1.5 token，500 char 安全
  const stripped = rawLogs.replace(/^---[\s\S]*?---\n+/, '');
  const lines = stripped.split('\n');
  const raw = [];
  let cur = null;
  // 兼容两种格式：
  //   新（v0.5+）：**HH:MM:SS**  内容（同行）  或  **HH:MM:SS**\n内容
  //   旧（v0.4-）：### 🕒 HH:MM:SS\n内容\n---
  const HEADER_RE = /^(?:\*\*(\d{2}):(\d{2}):(\d{2})\*\*|### 🕒\s+(\d{2}):(\d{2}):(\d{2}))\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(HEADER_RE);
    if (m) {
      if (cur && cur.text.trim()) raw.push(cur);
      const time = `${m[1] || m[4]}:${m[2] || m[5]}:${m[3] || m[6]}`;
      cur = { time, text: m[7] || '' };
    } else if (cur) {
      // 跳过旧格式的 `---` 分隔符、以及全空行不要拼成噪音
      if (/^---+\s*$/.test(line)) continue;
      cur.text += (cur.text ? '\n' : '') + line;
    }
  }
  if (cur && cur.text.trim()) raw.push(cur);

  // 二次处理：长 chunk 切短 + 短 chunk 过滤
  const out = [];
  for (const c of raw) {
    const text = c.text.trim();
    // 过滤"只是图片/媒体链接"的 chunk —— 真实语义内容不到 4 字 = 没什么可检索的
    const semantic = semanticContent(text);
    if (semantic.length < 4) continue;

    if (text.length <= MAX_CHARS) {
      out.push({ time: c.time, text });
    } else {
      // 按 \n\n 段落切；每段还超过 MAX_CHARS 就硬切
      const parts = text.split(/\n\n+/);
      let buf = '';
      for (const p of parts) {
        if ((buf + '\n\n' + p).length > MAX_CHARS && buf) {
          out.push({ time: c.time, text: buf.trim() });
          buf = p;
        } else {
          buf = buf ? buf + '\n\n' + p : p;
        }
        if (buf.length > MAX_CHARS) {
          // 单段超长 → 按字符硬切
          for (let i = 0; i < buf.length; i += MAX_CHARS) {
            out.push({ time: c.time, text: buf.slice(i, i + MAX_CHARS) });
          }
          buf = '';
        }
      }
      if (buf.trim()) out.push({ time: c.time, text: buf.trim() });
    }
  }
  return out;
}

function loadMeta() {
  if (!fs.existsSync(META_FILE)) {
    return { indexed: {}, model: EMBED_MODEL, version: 1 };
  }
  return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
}

function saveMeta(meta) {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

function loadAll() {
  if (!fs.existsSync(INDEX_FILE)) return [];
  return fs.readFileSync(INDEX_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

function saveAll(records) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, records.map(r => JSON.stringify(r)).join('\n') + '\n');
}

// 索引某一天的 raw_logs（已索引会替换该日所有 chunks）
async function indexDate(dateStr, options = {}) {
  ensureDir();
  const dirPath = path.join(VAULT_DIR, dateStr);
  const logFile = path.join(dirPath, '01_raw_logs.md');
  if (!fs.existsSync(logFile)) {
    return { date: dateStr, indexed: 0, reason: 'no logs' };
  }
  const rawLogs = fs.readFileSync(logFile, 'utf8');
  const chunks = splitLogsToChunks(rawLogs);
  if (!chunks.length) {
    return { date: dateStr, indexed: 0, reason: 'no chunks' };
  }

  // 移除该日已有索引（若是重建）
  const existing = loadAll().filter(r => r.date !== dateStr);

  const added = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    try {
      const embedding = await embedText(c.text);
      added.push({
        id: `${dateStr}_${String(i).padStart(3, '0')}`,
        date: dateStr,
        time: c.time,
        text: c.text,
        embedding,
      });
    } catch (e) {
      console.error(`[embed ${dateStr}#${i}] ${e.message}`);
    }
  }

  saveAll([...existing, ...added]);

  const meta = loadMeta();
  meta.indexed[dateStr] = {
    chunks: added.length,
    indexed_at: new Date().toISOString(),
  };
  meta.model = EMBED_MODEL;
  saveMeta(meta);

  return { date: dateStr, indexed: added.length };
}

// 查询：返回 top-k 最相关的 chunks
async function query(text, opts = {}) {
  const {
    topK = 6,
    minScore = 0.35,
    sinceDate = null,
    untilDate = null,
    excludeDate = null,
  } = opts;
  if (!fs.existsSync(INDEX_FILE)) return [];
  let queryEmb;
  try {
    queryEmb = await embedText(text);
  } catch (e) {
    console.error(`[query embed] ${e.message}`);
    return [];
  }
  let pool = loadAll();
  if (sinceDate) pool = pool.filter(r => r.date >= sinceDate);
  if (untilDate) pool = pool.filter(r => r.date <= untilDate);
  if (excludeDate) pool = pool.filter(r => r.date !== excludeDate);
  return pool
    .map(r => ({
      date: r.date,
      time: r.time,
      text: r.text,
      score: cosine(queryEmb, r.embedding),
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// 全量重建（一次性 / debug）
async function reindexAll(onProgress) {
  if (!fs.existsSync(VAULT_DIR)) return { total: 0, dates: 0 };
  const dates = fs.readdirSync(VAULT_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  // 清空老索引（避免遗留）
  ensureDir();
  if (fs.existsSync(INDEX_FILE)) fs.unlinkSync(INDEX_FILE);
  saveMeta({ indexed: {}, model: EMBED_MODEL, version: 1 });
  let total = 0;
  for (const d of dates) {
    const r = await indexDate(d);
    total += r.indexed || 0;
    if (onProgress) onProgress({ date: d, indexed: r.indexed, totalSoFar: total });
  }
  return { total, dates: dates.length };
}

// 检查 embedding 服务是否就绪
async function healthCheck() {
  try {
    const v = await embedText('ping');
    return { ok: true, dim: v.length, model: EMBED_MODEL };
  } catch (e) {
    return { ok: false, error: e.message, model: EMBED_MODEL };
  }
}

function indexStats() {
  const meta = loadMeta();
  const records = loadAll();
  const byDate = {};
  for (const r of records) {
    byDate[r.date] = (byDate[r.date] || 0) + 1;
  }
  return {
    model: meta.model,
    totalChunks: records.length,
    days: Object.keys(byDate).length,
    earliest: records.length ? records.reduce((a, b) => a.date < b.date ? a : b).date : null,
    latest: records.length ? records.reduce((a, b) => a.date > b.date ? a : b).date : null,
  };
}

module.exports = {
  embedText,
  indexDate,
  query,
  reindexAll,
  healthCheck,
  indexStats,
  splitLogsToChunks,
  loadMeta,
};
