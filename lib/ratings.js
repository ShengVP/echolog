// 反馈环：给 /diary 打分（1-5）+ 评语，累积到 .diary_ratings.jsonl
//
// 数据结构（一行一条 JSON）：
//   { date, version, rated_at, score, comment, file_path }
//
// 「最近一份 diary」= 整个 Daily_Vault 里 mtime 最新的 02_diary_v*.md

const fs = require('fs');
const path = require('path');

const VAULT_DIR = path.join(__dirname, '..', 'Daily_Vault');
const RATINGS_FILE = path.join(__dirname, '..', '.diary_ratings.jsonl');

function getRecentDiaryPath() {
  if (!fs.existsSync(VAULT_DIR)) return null;
  let latest = null;
  for (const dir of fs.readdirSync(VAULT_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) continue;
    const dirPath = path.join(VAULT_DIR, dir);
    for (const f of fs.readdirSync(dirPath)) {
      const m = f.match(/^02_diary_v(\d+)\.md$/);
      if (!m) continue;
      const full = path.join(dirPath, f);
      const mtime = fs.statSync(full).mtimeMs;
      if (!latest || mtime > latest.mtime) {
        latest = { path: full, date: dir, version: parseInt(m[1], 10), mtime };
      }
    }
  }
  return latest;
}

function loadRatings() {
  if (!fs.existsSync(RATINGS_FILE)) return [];
  return fs.readFileSync(RATINGS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function saveRating({ score, comment }) {
  const recent = getRecentDiaryPath();
  if (!recent) throw new Error('找不到任何 02_diary_v*.md（先跑一次 /diary）');
  const n = parseInt(score, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error('score 必须是 1-5 的整数');
  }
  const rec = {
    date: recent.date,
    version: recent.version,
    rated_at: new Date().toISOString(),
    score: n,
    comment: comment || '',
    file_path: path.relative(path.join(__dirname, '..'), recent.path),
  };
  fs.appendFileSync(RATINGS_FILE, JSON.stringify(rec) + '\n');
  return rec;
}

function summarizeRatings() {
  const ratings = loadRatings();
  if (!ratings.length) {
    return { total: 0, avg: null, byScore: {}, recent: [] };
  }
  const byScore = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of ratings) {
    byScore[r.score] = (byScore[r.score] || 0) + 1;
    sum += r.score;
  }
  return {
    total: ratings.length,
    avg: (sum / ratings.length).toFixed(2),
    byScore,
    recent: ratings.slice(-10).reverse(), // 最近 10 条
  };
}

module.exports = {
  getRecentDiaryPath,
  loadRatings,
  saveRating,
  summarizeRatings,
};
